const { body } = require("express-validator");

const registerValidator = [
  body("email").isEmail().withMessage("Invalid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("name").notEmpty().withMessage("Name is required"),
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
  body("guardian.email")
    .if(body("gender").equals("female"))
    .isEmail()
    .withMessage("Guardian email is required for female users"),
  body("guardian.phone")
    .if(body("gender").equals("female"))
    .notEmpty()
    .withMessage("Guardian phone is required for female users"),
];

module.exports = { registerValidator };
