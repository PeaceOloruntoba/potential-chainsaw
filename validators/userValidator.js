const { body } = require("express-validator");

const paymentValidator = [
  body("cardDetails.cardNumber")
    .notEmpty()
    .withMessage("Card number is required"),
  body("cardDetails.expiryDate")
    .matches(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)
    .withMessage("Invalid expiry date (MM/YY)"),
  body("cardDetails.cvv")
    .isLength({ min: 3, max: 4 })
    .withMessage("Invalid CVV"),
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
