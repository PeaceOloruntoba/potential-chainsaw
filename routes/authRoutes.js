const express = require("express");
const router = express.Router();
const {
  register,
  login,
  subscribe,
  cancelSubscription,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/subscribe", authenticate, subscribe);
router.post("/cancel-subscription", authenticate, cancelSubscription);
router.post("/confirm-paypal-subscription", authenticate, confirmPaypalSubscription);

module.exports = router;
