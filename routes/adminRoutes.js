const express = require("express");
const router = express.Router();
const {
  createUser,
  getAllProfiles,
  updateProfile, // Import the new updateProfile function
} = require("../controllers/adminController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/users", authenticate, createUser); // Admin can create users
router.get("/profiles", authenticate, getAllProfiles); // Admin can get all profiles
router.put("/profiles/:id", authenticate, updateProfile); // Admin can update profiles by ID

module.exports = router;
