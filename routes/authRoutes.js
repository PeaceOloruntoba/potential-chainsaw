const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const { validate } = require("../middleware/validatorMiddleware");
const { registerValidator } = require("../validators/authValidator");

router.post("/register", registerValidator, validate, register);
router.post("/login", login);

module.exports = router;
