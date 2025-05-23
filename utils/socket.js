const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./user");
const formatMessage = require("./message");
// const Message = require('../dao/messageDao'); // MongoDB model removed
const { format } = require("date-fns"); // Still used by formatMessage utility for live messages
const fs = require('fs');
const path = require('path');

function configureSocket(io) {
  io.on("connection", (socket) => {
    const botName = "AChat Manager";

    console.log("Connected to socket");
    socket.on("joinRoom", ({ username, roomName }) => {
      const user = userJoin(socket.id, username, roomName);

      socket.join(user.roomName);

      // Load chat history - Commented out as Message model is removed.
      // JSON file history loading would be implemented here if required.
      /*
      Message.find({ roomName: user.roomName })
        .sort({ timestamp: 1 })
        .lean()
        .exec((err, messages) => {
          if (err) {
            console.error("Error fetching chat history:", err);
            socket.emit("loadHistory", []); // Emit empty history on error
            return;
          }
          if (messages && messages.length > 0) {
            const formattedMessages = messages.map(msg => ({
              username: msg.username,
              text: msg.text,
              time: format(new Date(msg.timestamp), "h:mm a")
            }));
            socket.emit("loadHistory", formattedMessages);
          } else {
            socket.emit("loadHistory", []); // Emit empty history if no messages found
          }
        });
      */
      // Load chat history from JSON file
      const chatHistory = _loadChatHistoryFromJson(user.roomName);
      socket.emit("loadHistory", chatHistory);


      // Welcome current user
      socket.emit(
        "message",
        formatMessage(botName, "Welcome to AChat App, Let's talk !")
      );

      // Broadcast when a user connects
      socket.broadcast
        .to(user.roomName)
        .emit(
          "welcomeMessage",
          formatMessage(botName, `${user.username} has joined the chat`)
        );

      // Send users and room info
      io.to(user.roomName).emit("roomUsers", {
        roomName: user.roomName,
        users: getRoomUsers(user.roomName),
      });
    });

    // Listen for chatMessage
    socket.on("chatMessage", (msg) => {
      const user = getCurrentUser(socket.id);

      if (user && user.roomName) {
        const messageData = {
          username: user.username,
          text: msg,
          timestamp: new Date().toISOString()
        };
        _saveMessageToJson(user.roomName, messageData);
        // The actual emitting of the message should happen regardless of save success for real-time feel
        io.to(user.roomName).emit("message", formatMessage(user.username, msg));
      } else {
        if (!user) {
            console.error("chatMessage: User not found for socket id:", socket.id);
        } else {
            console.error("chatMessage: User found but roomName is missing for socket id:", socket.id);
        }
      }
    });

    // Runs when client disconnects
    socket.on("disconnect", () => {
      const user = userLeave(socket.id);

      if (user) {
        io.to(user.roomName).emit(
          "welcomeMessage",
          formatMessage(botName, `${user.username} has left the chat`)
        );

        // Send users and room info
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

module.exports = {
    configureSocket,
    _loadChatHistoryFromJson, // Export for testing
    _saveMessageToJson // Export for testing
};
