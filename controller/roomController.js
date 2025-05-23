const RoomDao = require("../dao/roomDao");
const RoomService =require("../service/roomService");
const { getMessagesPaginated } = require("../utils/socket"); // Import the helper
const StandardError = require("../utils/constant/standardError");


async function createRoom(req, res, next) {
  const userId = req.user.id; // Directly use authenticated user's ID
  const username = req.user.username; // Directly use authenticated user's username

  const { roomName, isLocked, isDiscoverable } = req.body; // Username removed from body
  const { db } = req;

  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    // The service expects userId, username, roomName, isLocked, isDiscoverable
    const result = await roomService.createRoom({
      userId,
      username, // Now using authenticated username
      roomName,
      isLocked,
      isDiscoverable
    });

    if (result.success) {
      return res.status(201).json({ // 201 Created is more appropriate
        success: true,
        message: "Successfully created a room",
        // result.message is the insertedId from DAO, result.accessLink is from service
        data: { roomId: result.message, accessLink: result.accessLink }, 
      });
    }
    // No explicit else needed if service throws StandardError for failures handled by error middleware
  } catch (error) {
    next(error);
  }
}

async function updateRoomSettings(req, res, next) {
  const userId = req.user.id; // Directly use authenticated user's ID

  const { roomId } = req.params;
  const { isLocked, isDiscoverable } = req.body;
  const { db } = req;

  if (isLocked === undefined && isDiscoverable === undefined) {
    return res.status(400).json({
      success: false,
      message: "At least one setting (isLocked or isDiscoverable) must be provided."
    });
  }

  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    const result = await roomService.updateRoomSettings({
      roomId,
      userId,
      settings: { isLocked, isDiscoverable }
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message, // Service provides a descriptive message
        data: result.data // Service returns the updated room data
      });
    }
  } catch (error) {
    next(error);
  }
}

async function joinRoomByAccessLink(req, res, next) {
  const { accessLink } = req.params;
  const { db } = req;

  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    const result = await roomService.findRoomByAccessLink({ accessLink });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Room found",
        data: { 
          roomId: result.data._id, 
          roomName: result.data.roomName // Assuming room object has roomName
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

async function deleteRoom(req, res, next) {
  const { id: roomId } = req.params; 
  const userId = req.user.id; // Get authenticated user's ID
  const { db } = req;
  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    // Service method now expects { roomId, userId }
    const result = await roomService.deleteRoom({ roomId, userId }); 
    if (result.success) {
      return res.status(200).json({ // OK
        success: true,
        message: result.message, // Service provides "Room deleted successfully."
      });
    } 
    // No explicit else needed if service throws StandardError for failures
  } catch (error) {
    next(error);
  }
}

async function getAllListRooms(req, res, next) {
  const { db } = req;
  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    const result = await roomService.getAllListRoom();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "List of all rooms",
        data: result.message,
      });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRoom,
  getAllListRooms,
  deleteRoom,
  updateRoomSettings,
  joinRoomByAccessLink,
  getOwnedRooms,
  getRoomMessagesPaginated, // Export the new function
};

async function getRoomMessagesPaginated(req, res, next) {
  try {
    const { roomName } = req.params;
    let { page, limit } = req.query;

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;

    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100; // Max limit

    // The getMessagesPaginated function is not async, it reads files synchronously
    const result = getMessagesPaginated(roomName, page, limit);

    if (result && result.messages) {
      // If page requested is out of actual available pages, but there are messages.
      if (page > result.totalPages && result.totalMessages > 0) {
         return res.status(404).json({
          success: false,
          message: `Page ${page} not found. Total pages: ${result.totalPages}.`,
          data: {
            totalPages: result.totalPages,
            totalMessages: result.totalMessages,
            limit: result.limit
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Messages retrieved successfully",
        data: {
          messages: result.messages,
          totalPages: result.totalPages,
          currentPage: result.currentPage,
          totalMessages: result.totalMessages,
          limit: result.limit,
        },
      });
    } else {
      // This case might be hit if getMessagesPaginated itself has an issue or roomName is invalid
      // However, getMessagesPaginated is designed to always return an object,
      // typically with messages: [] if no messages or room not found.
      // A more specific check for result.totalMessages === 0 might be better here.
      if (result.totalMessages === 0) {
        return res.status(200).json({ // 200 is okay if no messages, not necessarily 404
            success: true,
            message: "No messages found for this room.",
            data: {
                messages: [],
                totalPages: 0,
                currentPage: page,
                totalMessages: 0,
                limit: limit
            }
        });
      }
      // Fallback for other unexpected issues from getMessagesPaginated
      throw new StandardError({ status: 500, message: "Error retrieving messages." });
    }
  } catch (error) {
    // Log the error for server-side inspection if it's not a StandardError already
    if (!(error instanceof StandardError)) {
        console.error("Error in getRoomMessagesPaginated controller:", error);
    }
    next(error);
  }
}

async function getOwnedRooms(req, res, next) {
  const userId = req.user.id; // Directly use authenticated user's ID

  const { db } = req;

  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    const result = await roomService.getRoomsByOwner({ userId });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data 
      });
    }
    // Service layer should throw StandardError for failures, handled by error middleware
  } catch (error) {
    next(error);
  }
}
