const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./user");
const formatMessage = require("./message");
const { format } = require("date-fns"); // Still used by formatMessage utility for live messages
const fs = require('fs');
const path = require('path');
const jwt = require("jsonwebtoken");
const { JWT_SIGN } = require("../middleware/config/jwtConfig"); // Corrected path

function configureSocket(io) {
  io.on("connection", (socket) => {
    const botName = "AChat Manager";
    console.log("New client connected:", socket.id);

    socket.on('authenticate', (data) => {
      if (!data || !data.token) {
        console.log(`Authentication failed for socket ${socket.id}: No token provided`);
        socket.emit('unauthorized', { message: 'Authentication token not provided.' });
        socket.disconnect(true);
        return;
      }
      try {
        const decodedToken = jwt.verify(data.token, JWT_SIGN);
        socket.user = decodedToken; // Store user info (id, username, role) on the socket
        console.log(`Socket ${socket.id} authenticated as user: ${socket.user.username} (ID: ${socket.user.id})`);
        socket.emit('authenticated', { username: socket.user.username, userId: socket.user.id }); // Send confirmation to client
      } catch (error) {
        console.log(`Authentication failed for socket ${socket.id}: ${error.message}`);
        socket.emit('unauthorized', { message: 'Invalid authentication token.' });
        socket.disconnect(true);
      }
    });

    socket.on("joinRoom", ({ roomName }) => { // Username removed from params
      if (!socket.user) {
        console.log(`Join room failed for socket ${socket.id}: Socket not authenticated.`);
        socket.emit('error', { message: 'You must be authenticated to join a room.' });
        // Optionally disconnect if strict authentication is required before any action
        // socket.disconnect(true); 
        return;
      }

      // Use socket.user.username for userJoin
      const user = userJoin(socket.id, socket.user.username, roomName);

      if (!user) { // userJoin might return null/undefined if roomName is invalid or other issues
        console.error(`Failed to join user ${socket.user.username} to room ${roomName}.`);
        socket.emit('error', { message: `Failed to join room ${roomName}.` });
        return;
      }
      
      socket.join(user.roomName);

      const chatHistory = _loadChatHistoryFromJson(user.roomName);
      socket.emit("loadHistory", chatHistory);

      socket.emit(
        "message",
        formatMessage(botName, "Welcome to AChat App, Let's talk !")
      );

      socket.broadcast
        .to(user.roomName)
        .emit(
          "welcomeMessage",
          formatMessage(botName, `${user.username} has joined the chat`) // Username from socket.user
        );

      io.to(user.roomName).emit("roomUsers", {
        roomName: user.roomName,
        users: getRoomUsers(user.roomName),
      });
    });

    socket.on("chatMessage", (msg) => {
      if (!socket.user) {
        console.log(`Chat message failed for socket ${socket.id}: Socket not authenticated.`);
        socket.emit('error', { message: 'You must be authenticated to send messages.' });
        return;
      }
      const user = getCurrentUser(socket.id); // This still relies on the local users array managed by user.js

      if (user && user.roomName) {
        const messageData = {
          username: socket.user.username, // Correctly use authenticated user's username for saving
          text: msg,
          timestamp: new Date().toISOString()
        };
        _saveMessageToJson(user.roomName, messageData);
        io.to(user.roomName).emit("message", formatMessage(socket.user.username, msg)); // Use socket.user.username for emitting
      } else {
        if (!user) {
            console.error("chatMessage: User not found in local tracking for socket id:", socket.id);
        } else {
            console.error("chatMessage: User found but roomName is missing for socket id:", socket.id);
        }
        socket.emit('error', { message: 'Could not send message. User or room not found.' });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}${socket.user ? ` (User: ${socket.user.username})` : ''}`);
      const user = userLeave(socket.id); // userLeave needs to be aware of socket.id

      if (user) {
        io.to(user.roomName).emit(
          "welcomeMessage",
          formatMessage(botName, `${user.username} has left the chat`)
        );

        io.to(user.roomName).emit("roomUsers", {
          roomName: user.roomName,
          users: getRoomUsers(user.roomName),
        });
      }
    });
  });
}

// Helper function to load chat history from a JSON file
function _loadChatHistoryFromJson(roomName) {
  const chatsDir = path.join(__dirname, '..', 'db', 'chats');
  const roomFilePath = path.join(chatsDir, `${roomName}.json`);
  let chatHistory = [];

  try {
    if (fs.existsSync(roomFilePath)) {
      const fileData = fs.readFileSync(roomFilePath, 'utf-8');
      if (fileData.trim() !== '') {
        chatHistory = JSON.parse(fileData);
        if (!Array.isArray(chatHistory)) {
          console.error('Chat history file content is not an array, returning empty history for room:', roomName);
          chatHistory = [];
        }
      }
    }
  } catch (err) {
    console.error(`Error reading or parsing chat history file for room ${roomName}:`, err);
    chatHistory = []; // Return empty on error
  }
  return chatHistory;
}

// Helper function to save a message to a JSON file
function _saveMessageToJson(roomName, messageData) {
  // Ensure username in messageData is consistently from socket.user if possible,
  // though here it's passed in. For new messages, ensure it's from socket.user.username.
  const chatsDir = path.join(__dirname, '..', 'db', 'chats');
  const roomFilePath = path.join(chatsDir, `${roomName}.json`);

  if (!fs.existsSync(chatsDir)) {
    try {
      fs.mkdirSync(chatsDir, { recursive: true });
    } catch (err) {
      console.error('Error creating chat directory:', err);
      return false; // Indicate failure
    }
  }

  let roomMessages = [];
  try {
    if (fs.existsSync(roomFilePath)) {
      const fileData = fs.readFileSync(roomFilePath, 'utf-8');
      if (fileData.trim() !== '') {
        roomMessages = JSON.parse(fileData);
        if (!Array.isArray(roomMessages)) {
          console.error('Chat file content is not an array, reinitializing for room:', roomName);
          roomMessages = [];
        }
      }
    }
  } catch (err) {
    console.error(`Error reading or parsing chat file for room ${roomName}, reinitializing:`, err);
    roomMessages = []; // Initialize fresh if error
  }

  roomMessages.push(messageData);

  try {
    fs.writeFileSync(roomFilePath, JSON.stringify(roomMessages, null, 2), 'utf-8');
    // console.log('Message saved to JSON file for room:', roomName);
    return true; // Indicate success
  } catch (err) {
    console.error(`Error writing chat file for room ${roomName}:`, err);
    return false; // Indicate failure
  }
}

// New helper function for paginating messages
function getMessagesPaginated(roomName, page = 1, limit = 20) {
  const allMessages = _loadChatHistoryFromJson(roomName);
  const totalMessages = allMessages.length;

  if (totalMessages === 0) {
    return { messages: [], totalMessages, totalPages: 0, currentPage: page, limit };
  }

  const totalPages = Math.ceil(totalMessages / limit);
  // Ensure page is within bounds
  const currentPage = Math.max(1, Math.min(page, totalPages));

  // Calculate start and end index for slicing from the end of the array (oldest first)
  // Page 1 should be the newest messages, which are at the end of the 'allMessages' array.
  let startIndex = totalMessages - (currentPage * limit);
  let endIndex = totalMessages - ((currentPage - 1) * limit);

  // Ensure startIndex is not negative
  startIndex = Math.max(0, startIndex);
  
  // Slice the array to get the messages for the current page.
  // These messages will be in chronological order (oldest to newest within the page).
  const messagesForPage = allMessages.slice(startIndex, endIndex);

  // Reverse the messages for the page to have newest first, as typically expected in chat UI.
  const reversedMessagesForPage = messagesForPage.reverse();

  return {
    messages: reversedMessagesForPage,
    totalMessages,
    totalPages,
    currentPage,
    limit
  };
}

module.exports = {
    configureSocket,
    _loadChatHistoryFromJson, 
    _saveMessageToJson,
    getMessagesPaginated // Export the new function
};
