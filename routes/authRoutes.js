const express = require("express");
const router = express.Router();
const { register, login, subscribe } = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/subscribe", authenticate, subscribe);

module.exports = router;
