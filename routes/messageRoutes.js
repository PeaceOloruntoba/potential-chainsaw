const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const { sendMessage } = require("../controllers/messageController");
const { validate } = require("../middleware/validatorMiddleware");
const { messageValidator } = require("../validators/userValidator");

router.post("/", authenticate, messageValidator, validate, sendMessage);

module.exports = router;
