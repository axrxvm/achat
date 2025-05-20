const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ message: "Hello World! You are viewing the index page of AChat v1 API." });
});
router.get("/status", (req, res) => {
  res.status(200).json({ message: "AChat API is running! ALL OK" });
});

module.exports = router;
