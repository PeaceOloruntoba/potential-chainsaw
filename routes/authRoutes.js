const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const { validate } = require("../middleware/validatorMiddleware");
const { registerValidator } = require("../validators/authValidator");

router.post("/register", register);
router.post("/login", login);
router.post("/paypal/create-order", createPayPalOrder);

module.exports = router;
