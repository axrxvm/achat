const express = require("express");
const {
  createRoom,
  getAllListRooms,
  deleteRoom,
  updateRoomSettings,
  joinRoomByAccessLink,
  getOwnedRooms, // Import the new controller function
} = require("../controller/roomController");

const router = express.Router();

// Placeholder for authentication middleware
const authMiddlewarePlaceholder = (req, res, next) => {
  // This is a placeholder. In a real application, this would verify a JWT, session, etc.
  // and populate req.user if authentication is successful.
  console.warn("Using placeholder authentication middleware.");
  // For testing purposes, you might simulate a user:
  // req.user = { id: "simulatedUserId123", username: "simulatedUser" };
  next();
};


router.post("/", authMiddlewarePlaceholder, createRoom); // Added auth placeholder
router.get("/", getAllListRooms);
router.delete("/:id", authMiddlewarePlaceholder, deleteRoom); // Added auth placeholder

// New routes
router.put("/:roomId/settings", authMiddlewarePlaceholder, updateRoomSettings);
router.get("/join/:accessLink", joinRoomByAccessLink);
router.get('/ownedByMe', authMiddlewarePlaceholder, getOwnedRooms); // Add the new route


module.exports = router;
