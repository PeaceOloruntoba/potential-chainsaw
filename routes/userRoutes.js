const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getSingleUserProfileWithPhotos,
} = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, getSingleUserProfileWithPhotos);
router.get("/:userId", authenticate, getSingleUserProfileWithPhotos);
router.get("/profile", authenticate, getProfile);
router.post("/profile", authenticate, updateProfile);

module.exports = router;
