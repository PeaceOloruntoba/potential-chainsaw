const express = require("express");
const router = express.Router();
const {
  uploadPhoto,
  getPhotos,
  requestPhotoAccess,
  respondToPhotoRequest,
} = require("../controllers/photoController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/", authenticate, uploadPhoto);
router.get("/", authenticate, getPhotos);
router.post("/request", authenticate, requestPhotoAccess);
router.post("/request/respond", authenticate, respondToPhotoRequest);

module.exports = router;
