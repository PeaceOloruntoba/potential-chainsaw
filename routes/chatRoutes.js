const express = require("express");
const router = express.Router();
const {
  getChats,
  sendMessage,
  getMessages,
} = require("../controllers/chatController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, getChats);
router.post("/messages", authenticate, sendMessage);
router.get("/messages/:otherUserId", authenticate, getMessages);

module.exports = router;
