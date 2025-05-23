const RoomDao = require("../dao/roomDao");
const RoomService = require("../service/roomService");

async function createRoom(req, res, next) {
  let userId;
  if (req.user && req.user.id) {
    userId = req.user.id;
  } else {
    userId = "TODO_Implement_Auth_UserId";
    console.warn("Using placeholder userId in roomController.createRoom");
  }

  const { username, roomName, isLocked, isDiscoverable } = req.body;
  const { db } = req;

  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    // The service expects userId, username, roomName, isLocked, isDiscoverable
    const result = await roomService.createRoom({ 
      userId, 
      username, // username is still needed by service/DAO for 'createdBy' and user lookup
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
  let userId;
  if (req.user && req.user.id) {
    userId = req.user.id;
  } else {
    userId = "TODO_Implement_Auth_UserId";
    console.warn("Using placeholder userId in roomController.updateRoomSettings");
  }

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
  const { id: roomId } = req.params; // Renaming for clarity to match other functions
  const { db } = req;
  try {
    const roomDao = new RoomDao(db);
    const roomService = new RoomService(roomDao);
    // Service method expects { id }, consistent with previous versions
    const result = await roomService.deleteRoom({ id: roomId }); 
    if (result.success) {
      return res.status(200).json({
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
};

async function getOwnedRooms(req, res, next) {
  let userId;
  if (req.user && req.user.id) {
    userId = req.user.id;
  } else {
    // This is a critical part for security, ensure proper auth in a real app.
    userId = "TODO_Implement_Auth_UserId"; // Placeholder
    console.warn("Using placeholder userId in roomController.getOwnedRooms. THIS IS INSECURE.");
  }

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
