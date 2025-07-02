const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getProfiles,
  cancelSubscriptionHandler,
} = require("../controllers/userController");
const { validate } = require("../middleware/validatorMiddleware");
const { paymentValidator } = require("../validators/userValidator");
const { processPayment } = require("../services/paymentService");

router.get("/profiles", authenticate, getProfiles);
router.post("/subscription/cancel", authenticate, cancelSubscriptionHandler);
router.post(
  "/subscription/process",
  authenticate,
  paymentValidator,
  validate,
  async (req, res, next) => {
    try {
      const order = await processPayment(req.user.id, req.body.cardDetails);
      res.json({ message: "Payment processed successfully", order });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
