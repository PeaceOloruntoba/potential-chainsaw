const express = require("express");
const router = express.Router();
const { register, login, createPayPalOrder } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/paypal/create-order", createPayPalOrder);

module.exports = router;
