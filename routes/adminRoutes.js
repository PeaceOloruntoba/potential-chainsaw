const express = require("express");
const router = express.Router();
const {
  createUser,
  getAllProfiles,
} = require("../controllers/adminController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/users", authenticate, createUser);
router.get("/profiles", authenticate, getAllProfiles);

module.exports = router;
