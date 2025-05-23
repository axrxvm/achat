const express = require("express");
const {
  createRoom,
  getAllListRooms,
  deleteRoom,
  updateRoomSettings,
  joinRoomByAccessLink,
  getOwnedRooms,
  getRoomMessagesPaginated, // Import the new controller function
} = require("../controller/roomController");
const { userAuthentication } = require("../middleware/authMiddleware"); // Import actual auth middleware

const router = express.Router();

// Replace placeholder with actual authentication middleware
router.post("/", userAuthentication, createRoom);
router.get("/", getAllListRooms); // Assuming this is a public list, if not, add userAuthentication
router.delete("/:id", userAuthentication, deleteRoom);

// New routes
router.put("/:roomId/settings", userAuthentication, updateRoomSettings);
router.get("/join/:accessLink", joinRoomByAccessLink); // Typically public or uses a one-time token mechanism
router.get('/owned', userAuthentication, getOwnedRooms); // Changed to /owned and uses actual auth

// Route for paginated messages
router.get("/:roomName/messages", userAuthentication, getRoomMessagesPaginated);

module.exports = router;
