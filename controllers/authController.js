const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { jwtSecret } = require("../config");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { processPayment } = require("../services/paymentService");
const { notifyGuardian } = require("../services/notificationService");

const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      age,
      gender,
      university,
      status,
      description,
      lookingFor,
      guardianEmail,
      guardianPhone,
      cardNumber,
      expiryDate,
      cvv,
      agreeTerms,
    } = req.body;

    if (password !== confirmPassword) {
      throw createError(400, "Passwords do not match");
    }
    if (!agreeTerms) {
      throw createError(400, "You must agree to the terms");
    }

    const db = getDB();
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) throw createError(400, "User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      age: parseInt(age),
      gender,
      university,
      status,
      description,
      lookingFor,
      subscription: { status: "trial", startDate: new Date() },
      ...(gender === "female"
        ? { guardian: { email: guardianEmail, phone: guardianPhone } }
        : {}),
      isAdmin: false,
    };

    // Process PayPal payment setup
    const cardDetails = { cardNumber, expiryDate, cvv };
    const paypalOrder = await processPayment(null, cardDetails); // User ID not yet available
    user.subscription.cardDetails = {
      last4: cardNumber.slice(-4),
      processor: "paypal",
      paypalOrderId: paypalOrder.id,
    };

    const result = await db.collection("users").insertOne(user);
    const token = jwt.sign({ id: result.insertedId }, jwtSecret, {
      expiresIn: "30d",
    });

    if (gender === "female" && guardianEmail && guardianPhone) {
      await notifyGuardian(
        { email: guardianEmail, phone: guardianPhone },
        {
          message: "New user registered",
          userId: result.insertedId,
        }
      );
    }

    logger.info(`User registered: ${email}`);
    res.status(201).json({ token, userId: result.insertedId });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDB();
    const user = await db.collection("users").findOne({ email });
    if (!user) throw createError(400, "Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw createError(400, "Invalid credentials");

    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "30d" });
    logger.info(`User logged in: ${email}`);
    res.json({ token, userId: user._id });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };
