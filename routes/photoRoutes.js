const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  requestPhoto,
  respondPhotoRequest,
} = require("../controllers/photoController");
const { validate } = require("../middleware/validatorMiddleware");
const {
  photoRequestValidator,
  photoResponseValidator,
} = require("../validators/userValidator");

router.post(
  "/request",
  authenticate,
  photoRequestValidator,
  validate,
  requestPhoto
);
router.post(
  "/respond",
  authenticate,
  photoResponseValidator,
  validate,
  respondPhotoRequest
);

module.exports = router;
