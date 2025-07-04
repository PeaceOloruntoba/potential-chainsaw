const express = require("express");
const router = express.Router();
const {
  getChats,
  sendMessage,
  getMessages,
  markMessageAsRead,
} = require("../controllers/chatController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, getChats);
router.post("/messages", authenticate, sendMessage);
router.get("/messages/:otherUserId", authenticate, getMessages);
router.post("/messages/read", authenticate, markMessageAsRead);

module.exports = router;
