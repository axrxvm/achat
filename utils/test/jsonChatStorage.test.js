const fs = require('fs');
const path = require('path');
// Correctly import the functions from utils/socket.js
const { _loadChatHistoryFromJson, _saveMessageToJson } = require('../socket'); 

jest.mock('fs');

// Define the base path for chats directory used in the socket.js functions
// path.join(__dirname, '..', 'db', 'chats')
// Since __dirname in the test file will be utils/test/
// and in socket.js it's utils/
// we need to adjust or ensure the path construction is consistent or mocked.
// For simplicity, we assume the path construction within the functions will be tested
// and fs calls are mocked based on expected absolute paths.
const MOCK_CHATS_DIR = path.resolve(__dirname, '..', '..', 'db', 'chats');

describe('_saveMessageToJson', () => {
  beforeEach(() => {
    // Reset all fs mocks before each test
    fs.existsSync.mockReset();
    fs.mkdirSync.mockReset();
    fs.readFileSync.mockReset();
    fs.writeFileSync.mockReset();
    // Clear any console spy if used, or use jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error during tests
  });

  afterEach(() => {
    // Restore console.error
    console.error.mockRestore();
  });

  const roomName = 'testRoom';
  const messageData = { username: 'user1', text: 'Hello', timestamp: new Date().toISOString() };
  const roomFilePath = path.join(MOCK_CHATS_DIR, `${roomName}.json`);

  test('should create directory if it does not exist and save message to new file', () => {
    fs.existsSync.mockImplementation(p => {
      if (p === MOCK_CHATS_DIR) return false; // Directory does not exist
      if (p === roomFilePath) return false;   // File does not exist
      return false;
    });
    fs.writeFileSync.mockReturnValue(undefined); // Simulate successful write

    const result = _saveMessageToJson(roomName, messageData);

    expect(fs.mkdirSync).toHaveBeenCalledWith(MOCK_CHATS_DIR, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify([messageData], null, 2), 'utf-8');
    expect(result).toBe(true);
  });

  test('should save message to new file if directory exists but file does not', () => {
    fs.existsSync.mockImplementation(p => {
      if (p === MOCK_CHATS_DIR) return true;  // Directory exists
      if (p === roomFilePath) return false; // File does not exist
      return false;
    });
    fs.writeFileSync.mockReturnValue(undefined);

    const result = _saveMessageToJson(roomName, messageData);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify([messageData], null, 2), 'utf-8');
    expect(result).toBe(true);
  });

  test('should append message to existing valid chat file', () => {
    const existingMessages = [{ username: 'user0', text: 'Hi', timestamp: new Date().toISOString() }];
    fs.existsSync.mockReturnValue(true); // Both dir and file exist
    fs.readFileSync.mockReturnValue(JSON.stringify(existingMessages));
    fs.writeFileSync.mockReturnValue(undefined);

    const result = _saveMessageToJson(roomName, messageData);
    
    const expectedMessages = [...existingMessages, messageData];
    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify(expectedMessages, null, 2), 'utf-8');
    expect(result).toBe(true);
  });

  test('should handle empty existing file by creating a new array with the message', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(''); // Empty file
    fs.writeFileSync.mockReturnValue(undefined);

    const result = _saveMessageToJson(roomName, messageData);

    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify([messageData], null, 2), 'utf-8');
    expect(result).toBe(true);
  });

  test('should handle corrupt existing JSON file by reinitializing with new message', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('{"invalidJson":'); // Corrupt JSON
    fs.writeFileSync.mockReturnValue(undefined);

    const result = _saveMessageToJson(roomName, messageData);

    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify([messageData], null, 2), 'utf-8');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error reading or parsing chat file for room ${roomName}`), expect.any(Error));
    expect(result).toBe(true); // Still true because it reinitializes and writes
  });
  
  test('should handle existing file content that is not an array by reinitializing', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ not: "an array" }));
    fs.writeFileSync.mockReturnValue(undefined);

    const result = _saveMessageToJson(roomName, messageData);
    expect(fs.writeFileSync).toHaveBeenCalledWith(roomFilePath, JSON.stringify([messageData], null, 2), 'utf-8');
    expect(console.error).toHaveBeenCalledWith('Chat file content is not an array, reinitializing for room:', roomName);
    expect(result).toBe(true);
  });


  test('should return false if fs.writeFileSync throws an error', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify([]));
    fs.writeFileSync.mockImplementation(() => { throw new Error('Disk full'); });

    const result = _saveMessageToJson(roomName, messageData);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error writing chat file for room ${roomName}`), expect.any(Error));
    expect(result).toBe(false);
  });

  test('should return false if fs.mkdirSync throws an error', () => {
    fs.existsSync.mockReturnValue(false); // Directory does not exist
    fs.mkdirSync.mockImplementation(() => { throw new Error('Permission denied'); });

    const result = _saveMessageToJson(roomName, messageData);
    
    expect(console.error).toHaveBeenCalledWith('Error creating chat directory:', expect.any(Error));
    expect(result).toBe(false);
  });
});


describe('_loadChatHistoryFromJson', () => {
  beforeEach(() => {
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    console.error.mockRestore();
  });

  const roomName = 'testRoom';
  const roomFilePath = path.join(MOCK_CHATS_DIR, `${roomName}.json`);

  test('should return empty array if history file does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual([]);
  });

  test('should return parsed messages from a valid history file', () => {
    const messages = [{ text: 'msg1' }, { text: 'msg2' }];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(messages));
    
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual(messages);
  });

  test('should return empty array if history file is empty', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');
    
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual([]);
  });

  test('should return empty array if history file contains invalid JSON', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('{"invalidJson":');
    
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error reading or parsing chat history file for room ${roomName}`), expect.any(Error));
  });
  
  test('should return empty array if history file content is not an array', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ not: "an array" }));
    
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Chat history file content is not an array, returning empty history for room:', roomName);
  });

  test('should return empty array if fs.readFileSync throws an error', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => { throw new Error('Read error'); });
    
    const history = _loadChatHistoryFromJson(roomName);
    expect(history).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Error reading or parsing chat history file for room ${roomName}`), expect.any(Error));
  });
});
