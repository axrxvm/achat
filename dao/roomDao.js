const StandardError = require("../utils/constant/standardError");
const { format } = require("date-fns");
const { ObjectId } = require("mongodb");
class RoomDao {
  constructor(db) {
    this.db = db;
  }

  async createRoom({ roomName, username, ownerId, isLocked, isDiscoverable, accessLink }) {
    const newDate = new Date();
    const createdDate = format(newDate, "yyyy-MM-dd");
    
    // User lookup by username (existing logic, for createdBy and validation)
    const user = await this.db
      .collection("users")
      .findOne({ username: username }, { projection: { _id: 1 } }); // only need to check existence and get _id if needed
    if (!user) {
      throw new StandardError({ status: 404, message: `User '${username}' not found` });
    }

    const getRoom = await this.db
      .collection("rooms")
      .findOne({ roomName }, { isDeleted: { $exists: false } });

    if (getRoom) {
      throw new StandardError({
        status: 409, // 409 Conflict is more appropriate for existing resource
        message: `Room name '${roomName}' is already taken. Please try another.`,
      });
    }
    
    // Check for existing accessLink if it needs to be unique across non-deleted rooms
    if (accessLink) {
      const roomByAccessLink = await this.db.collection("rooms").findOne({ accessLink, isDeleted: { $exists: false } });
      if (roomByAccessLink) {
        throw new StandardError({
          status: 409,
          message: `Generated access link conflicts with an existing room. Please try again.`, // Should be rare with UUIDs
        });
      }
    }

    const roomData = {
      roomName,
      ownerId: ownerId ? new ObjectId(ownerId) : user._id, // Use provided ownerId or default to looked-up user's _id
      isLocked,
      isDiscoverable,
      accessLink,
      createdBy: username, // Keep existing createdBy field
      createdDate,
      // users: [], // Example if users array was part of schema
      // messages: [], // Example if messages array was part of schema
      isDeleted: false // Explicitly set isDeleted to false on creation
    };

    const room = await this.db.collection("rooms").insertOne(roomData);
    return room;
  }

  async getRoomById(roomId) {
    if (!ObjectId.isValid(roomId)) {
      throw new StandardError({ status: 400, message: "Invalid room ID format" });
    }
    const room = await this.db
      .collection("rooms")
      .findOne({ _id: new ObjectId(roomId), isDeleted: { $exists: false } });
    return room; // Returns null if not found
  }

  async getRoomsByOwnerId(userId) {
    if (!ObjectId.isValid(userId)) {
      // Or handle this at the service layer if userId is already an ObjectId there
      throw new StandardError({ status: 400, message: "Invalid user ID format for owner lookup" });
    }
    const rooms = await this.db
      .collection("rooms")
      .find({ ownerId: new ObjectId(userId), isDeleted: { $exists: false } }) // Ensure not deleted
      .toArray();
    return rooms;
  }

  async updateRoom(roomId, updateData) {
    if (!ObjectId.isValid(roomId)) {
      throw new StandardError({ status: 400, message: "Invalid room ID format" });
    }
    const result = await this.db
      .collection("rooms")
      .updateOne({ _id: new ObjectId(roomId) }, { $set: updateData });
    return result; // Contains matchedCount, modifiedCount etc.
  }

  async findRoomByAccessLink(accessLink) {
    const room = await this.db
      .collection("rooms")
      .findOne({ accessLink: accessLink, isDeleted: { $exists: false } });
    return room; // Returns null if not found
  }

  async findAllListRoom() {
    // Only list rooms that are discoverable and not logically deleted
    const room = await this.db
      .collection("rooms")
      .find({ isDiscoverable: true, isDeleted: { $exists: false } })
      .toArray();
    return room;
  }

  async deleteRoom({ id }) {
    if (!ObjectId.isValid(id)) {
      throw new StandardError({ status: 400, message: "Invalid room ID format" });
    }
    const objectId = new ObjectId(id);
    
    // Check if room exists (optional, findOneAndUpdate can also tell if it matched)
    const getRoom = await this.db
      .collection("rooms")
      .findOne({ _id: objectId, isDeleted: { $exists: false } }); // Ensure not already deleted

    if (!getRoom) {
      throw new StandardError({ status: 404, message: "Room not found or already deleted" });
    }

    const result = await this.db
      .collection("rooms")
      .updateOne({ _id: objectId }, { $set: { isDeleted: true } }); // Use updateOne for logical delete

    return result; // Return the result of updateOne
  }
}

module.exports = RoomDao;
