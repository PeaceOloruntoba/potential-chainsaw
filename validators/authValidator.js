const { body } = require("express-validator");

const registerValidator = [
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Invalid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
  body("age").isInt({ min: 18 }).withMessage("Age must be at least 18"),
  body("gender")
    .isIn(["male", "female"])
    .withMessage("Gender must be male or female"),
  body("university").notEmpty().withMessage("University is required"),
  body("status")
    .isIn(["student", "graduate"])
    .withMessage("Status must be student or graduate"),
  body("description").notEmpty().withMessage("Description is required"),
  body("lookingFor").notEmpty().withMessage("Looking for is required"),
  body("guardianEmail")
    .if(body("gender").equals("female"))
    .isEmail()
    .withMessage("Guardian email is required for female users"),
  body("guardianPhone")
    .if(body("gender").equals("female"))
    .notEmpty()
    .withMessage("Guardian phone is required for female users"),
  body("cardNumber").notEmpty().withMessage("Card number is required"),
  body("expiryDate")
    .matches(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)
    .withMessage("Invalid expiry date (MM/YY)"),
  body("cvv").isLength({ min: 3, max: 4 }).withMessage("Invalid CVV"),
  body("agreeTerms").equals("true").withMessage("You must agree to the terms"),
];

module.exports = { registerValidator };
