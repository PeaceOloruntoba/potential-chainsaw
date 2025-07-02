const express = require("express");
const router = express.Router();
const {
  getOppositeGenderUsers,
  getProfile,
  updateProfile,
} = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, getOppositeGenderUsers);
router.get("/profile", authenticate, getProfile);
router.post("/profile", authenticate, updateProfile);

module.exports = router;
