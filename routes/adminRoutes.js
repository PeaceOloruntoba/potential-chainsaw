const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");
const {
  createProfile,
  getAllProfiles,
} = require("../controllers/adminController");
const { validate } = require("../middleware/validatorMiddleware");
const { registerValidator } = require("../validators/authValidator");

router.post(
  "/profiles",
  authenticate,
  isAdmin,
  registerValidator,
  validate,
  createProfile
);
router.get("/profiles", authenticate, isAdmin, getAllProfiles);

module.exports = router;
