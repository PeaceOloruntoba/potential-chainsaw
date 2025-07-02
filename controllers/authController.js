// controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getDB, ObjectId } = require("../config/db");
const { jwtSecret } = require("../config");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { authorizePayment } = require("../services/paymentService"); // Still needed for /subscribe page
const { notifyGuardian } = require("../services/notificationService");

const createPayPalOrder = async (req, res, next) => {
  try {
    const amount = "14.99"; // Subscription amount
    const currency = "GBP";
    const description = "UniStudents Match Monthly Subscription Authorization";

    const order = await authorizePayment(amount, currency, description);
    res.status(200).json({ orderId: order.id });
  } catch (error) {
    next(error);
  }
};

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
      agreeTerms,
      // Removed paypalOrderId, cardLast4, cardProcessor from here
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
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

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
      subscription: {
        status: "trial", // Initial status is trial
        startDate: now,
        trialEndsAt: trialEndsAt,
        // cardDetails are no longer set during initial registration
      },
      ...(gender === "female"
        ? { guardian: { email: guardianEmail, phone: guardianPhone } }
        : {}),
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
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

    logger.info(
      `User registered: ${email} with trial ending on ${trialEndsAt.toISOString()}`
    );
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

module.exports = { register, login, createPayPalOrder };
