const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const userService = require("../services/userService");
const paymentService = require("../services/paymentService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

const register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      age,
      gender,
      university,
      status,
      description,
      lookingFor,
      guardianEmail,
      guardianPhone,
    } = req.body;

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !university ||
      !status ||
      !description ||
      !lookingFor
    ) {
      return res
        .status(400)
        .json({ error: { message: "All required fields must be provided" } });
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      return res
        .status(400)
        .json({
          error: { message: "Guardian details are required for female users" },
        });
    }

    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: { message: "Email already exists" } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      age: parseInt(age),
      gender,
      university,
      status,
      description,
      lookingFor,
      guardianEmail: gender === "female" ? guardianEmail : undefined,
      guardianPhone: gender === "female" ? guardianPhone : undefined,
      hasActiveSubscription: false, // Default to false
    };

    const user = await userService.createUser(userData);
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    if (gender === "female" && guardianEmail) {
      await notificationService.notifyGuardian(
        guardianEmail,
        firstName,
        "registration"
      );
    }

    logger.info(`User registered: ${email}`);
    res.status(201).json({ token, userId: user._id });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: { message: "Email and password are required" } });
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      return res
        .status(401)
        .json({ error: { message: "Invalid credentials" } });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: { message: "Invalid credentials" } });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    logger.info(`User logged in: ${email}`);
    res.json({
      token,
      userId: user._id,
      hasActiveSubscription: user.hasActiveSubscription,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

const subscribe = async (req, res, next) => {
  try {
    const { userId } = req.user; // From auth middleware
    const { paymentDetails } = req.body;

    if (
      !paymentDetails ||
      !paymentDetails.cardNumber ||
      !paymentDetails.expiryDate ||
      !paymentDetails.cvv
    ) {
      return res
        .status(400)
        .json({ error: { message: "Payment details are required" } });
    }

    // Process payment via PayPal
    const paymentResult = await paymentService.processPayment(
      userId,
      paymentDetails
    );

    if (paymentResult.success) {
      // Update user's subscription status
      await userService.updateUser(userId, { hasActiveSubscription: true });

      logger.info(`Subscription successful for user: ${userId}`);
      res.json({
        message: "Subscription successful",
        hasActiveSubscription: true,
      });
    } else {
      return res
        .status(400)
        .json({ error: { message: "Payment processing failed" } });
    }
  } catch (error) {
    logger.error(`Subscription error: ${error.message}`);
    next(error);
  }
};

module.exports = { register, login, subscribe };
