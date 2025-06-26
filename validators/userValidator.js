const { body } = require("express-validator");

const paymentValidator = [
  body("cardDetails.token").notEmpty().withMessage("Card token is required"),
  body("cardDetails.last4")
    .isLength({ min: 4, max: 4 })
    .withMessage("Invalid card last 4 digits"),
];

const messageValidator = [
  body("receiverId").notEmpty().withMessage("Receiver ID is required"),
  body("content").notEmpty().withMessage("Message content is required"),
];

const photoRequestValidator = [
  body("targetId").notEmpty().withMessage("Target ID is required"),
];

const photoResponseValidator = [
  body("requestId").notEmpty().withMessage("Request ID is required"),
  body("status")
    .isIn(["accepted", "rejected"])
    .withMessage("Status must be accepted or rejected"),
];

module.exports = {
  paymentValidator,
  messageValidator,
  photoRequestValidator,
  photoResponseValidator,
};
