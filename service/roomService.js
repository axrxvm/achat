const StandardError = require("../utils/constant/standardError");
const { v4: uuidv4 } = require('uuid');

class RoomService {
  constructor(roomDao) {
    this.roomDao = roomDao;
  }

  async createRoom({ userId, username, roomName, isLocked, isDiscoverable }) { // Added userId and username
    try {
      // Validate required inputs for service layer
      if (!userId || !username || !roomName) {
        throw new StandardError({
          success: false,
          message: "User ID, username, and room name are required.",
          status: 400,
        });
      }
      if (roomName.trim() === "") {
        throw new StandardError({
          success: false,
          message: "Room name cannot be blank. Please try again.",
          status: 400,
        });
      }

      const accessLink = uuidv4();
      
      // Prepare data for DAO, including new fields and defaults
      const roomDetails = {
        roomName,
        username, // For DAO's user lookup and createdBy
        ownerId: userId,
        isLocked: isLocked || false,
        isDiscoverable: isDiscoverable !== undefined ? isDiscoverable : true,
        accessLink
      };

      const room = await this.roomDao.createRoom(roomDetails);

      return { success: true, message: room.insertedId, accessLink: accessLink }; // Return accessLink as well
    } catch (error) {
      console.log(error);
      // Preserve original error status and message if it's a StandardError
      if (error instanceof StandardError) {
        throw error;
      }
      // For other errors, wrap them
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async getAllListRoom() {
    try {
      const room = await this.roomDao.findAllListRoom();
      // No need to check !room here, as an empty array is a valid response (no rooms)
      // The DAO method find().toArray() will return [] if no documents match
      return { success: true, message: room };
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async userJoin({ username, roomName }) {
    try {
      if (!roomName || !username) {
        throw new StandardError({
          success: false,
          message: "Username and room name are required for joining.",
          status: 400,
        });
      }

      // This method seems to be about recording a user joining a room,
      // not creating a room. The current structure of roomDao.userJoin is unknown.
      // Assuming it handles the logic of adding a user to a room or similar.
      // If this method needs to interact with new room properties (e.g. isLocked),
      // then roomDao.userJoin would need to be aware of them.
      // For now, just passing through.
      const result = await this.roomDao.userJoin({
        username,
        roomName,
      });

      // It's better to let the DAO throw if the room doesn't exist or user cannot join.
      // The DAO should return meaningful data or throw a StandardError.
      // If result is just an ID:
      return { success: true, message: result.insertedId }; 
      // If result is more complex, adjust accordingly.
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async getUserJoin({ username, roomName }) {
    try {
      if (!roomName || !username) {
        throw new StandardError({
          success: false,
          message: "Username and room name are required to get user join info.",
          status: 400,
        });
      }

      const userJoinInfo = await this.roomDao.getUserJoin({
        username,
        roomName,
      });

      if (!userJoinInfo) {
        // This implies the specific user-room join record wasn't found.
        throw new StandardError({ status: 404, message: "User join information not found." });
      }
      return { success: true, message: userJoinInfo };
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async getUserJoinbyRoomName({ roomName }) {
    try {
      if (!roomName) {
        throw new StandardError({
          status: 400,
          message: "Room name is required.",
        });
      }
      const usersInRoom = await this.roomDao.getUserJoinbyRoomName({ roomName });
      // DAO should return empty array if no users, or throw if room itself not found.
      // Assuming it returns an array of users or user-join records.
      if (!usersInRoom) { // This check might be redundant if DAO always returns array
        throw new StandardError({
          status: 404,
          message: "No users found for this room or room does not exist.",
        });
      }
      return { success: true, message: usersInRoom };
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async userLeaveRoom({ username }) {
    try {
      if (!username) {
         throw new StandardError({
          status: 400,
          message: "Username is required to leave room.",
        });
      }
      const result = await this.roomDao.userLeaveRoom({ username });

      if (!result || (result.modifiedCount === 0 && result.matchedCount === 0)) { // Check depends on DAO return
        throw new StandardError({
          status: 404,
          message: "User was not in a room or could not be removed.",
        });
      }
      return { success: true, message: "User left room successfully." }; // Or return result from DAO
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async deleteRoom({ id }) {
    try {
      if (!id) {
        throw new StandardError({
          status: 400,
          message: "Room ID is required for deletion.",
        });
      }
      const result = await this.roomDao.deleteRoom({ id });

      // Assuming DAO's deleteRoom returns an object like { acknowledged: true, deletedCount: 1 }
      // or throws if room not found for deletion.
      if (!result || result.deletedCount === 0) { // Check if delete was effective
         throw new StandardError({ status: 404, message: "Room not found or already deleted." });
      }
      return { success: true, message: "Room deleted successfully." };
    } catch (error) {
      console.log(error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: error.status, message: error.message });
    }
  }

  async updateRoomSettings({ roomId, userId, settings }) {
    try {
      if (!roomId || !userId || !settings) {
        throw new StandardError({ status: 400, message: "Room ID, User ID, and settings are required." });
      }

      const room = await this.roomDao.getRoomById(roomId);
      if (!room) {
        throw new StandardError({ status: 404, message: "Room not found." });
      }

      // Ensure userId is a string for comparison, as room.ownerId might be an ObjectId
      // DAO stores ownerId as ObjectId, so it needs to be converted for comparison.
      if (room.ownerId.toString() !== userId.toString()) {
        throw new StandardError({ status: 403, message: "User is not the owner of the room." });
      }

      const updateData = {};
      if (settings.isLocked !== undefined) {
        updateData.isLocked = settings.isLocked;
      }
      if (settings.isDiscoverable !== undefined) {
        updateData.isDiscoverable = settings.isDiscoverable;
      }

      if (Object.keys(updateData).length === 0) {
        throw new StandardError({ status: 400, message: "No valid settings provided to update." });
      }

      const result = await this.roomDao.updateRoom(roomId, updateData);
      if (result.modifiedCount === 0 && result.matchedCount > 0) {
         // This means the settings provided were the same as current settings
        return { success: true, message: "Room settings were already up to date.", data: room };
      }
      if (result.modifiedCount === 0) {
          throw new StandardError({ status: 404, message: "Room settings could not be updated or room not found."})
      }


      // Fetch the updated room to return its latest state
      const updatedRoom = await this.roomDao.getRoomById(roomId);
      return { success: true, message: "Room settings updated successfully.", data: updatedRoom };

    } catch (error) {
      console.error("Error in updateRoomSettings service:", error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: 500, message: "An unexpected error occurred while updating room settings." });
    }
  }

  async findRoomByAccessLink({ accessLink }) {
    try {
      if (!accessLink) {
        throw new StandardError({ status: 400, message: "Access link is required." });
      }
      const room = await this.roomDao.findRoomByAccessLink(accessLink);
      if (!room) {
        throw new StandardError({ status: 404, message: "Room not found with the provided access link." });
      }
      return { success: true, message: "Room found.", data: room };
    } catch (error) {
      console.error("Error in findRoomByAccessLink service:", error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: 500, message: "An unexpected error occurred while finding room by access link." });
    }
  }

  async getRoomsByOwner({ userId }) {
    try {
      if (!userId) {
        throw new StandardError({ status: 400, message: "User ID is required to fetch owned rooms." });
      }
      // The DAO method getRoomsByOwnerId already handles ObjectId validation if userId is a string
      const rooms = await this.roomDao.getRoomsByOwnerId(userId);
      return { success: true, message: "Owned rooms retrieved successfully.", data: rooms };
    } catch (error) {
      console.error("Error in getRoomsByOwner service:", error);
      if (error instanceof StandardError) {
        throw error;
      }
      throw new StandardError({ status: 500, message: "An unexpected error occurred while retrieving owned rooms." });
    }
  }
}

module.exports = RoomService;
