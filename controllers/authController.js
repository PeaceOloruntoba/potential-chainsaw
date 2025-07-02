const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userService = require("../services/userService");
const paymentService = require("../services/paymentService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");
const { createError } = require("../utils/errorHandler");

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
      cardDetails,
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
      !lookingFor ||
      !cardDetails
    ) {
      throw createError(400, "All required fields must be provided");
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      throw createError(400, "Guardian details are required for female users");
    }

    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      throw createError(400, "Email already exists");
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
      isAdmin: false,
      hasActiveSubscription: false,
      subscription: {
        status: "trial",
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: null,
        nextBillingDate: null,
        paypalOrderId: null,
        stripePaymentMethodId: null,
        cardDetails: {
          cardNumber: cardDetails.cardNumber,
          expiryDate: cardDetails.expiryDate,
          cvv: cardDetails.cvv,
        },
      },
    };

    const user = await userService.createUser(userData);
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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
      throw createError(400, "Email and password are required");
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      throw createError(401, "Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError(401, "Invalid credentials");
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logger.info(`User logged in: ${email}`);
    res.status(200).json({
      token,
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      age: user.age,
      gender: user.gender,
      university: user.university,
      status: user.status,
      description: user.description,
      lookingFor: user.lookingFor,
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
      isAdmin: user.isAdmin,
      hasActiveSubscription: user.hasActiveSubscription,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

const subscribe = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { paymentProcessor } = req.body;

    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    if (user.subscription.status === "active") {
      throw createError(400, "User already subscribed");
    }

    let paymentResult;
    if (paymentProcessor === "stripe") {
      paymentResult = await paymentService.authorizeStripePayment(
        userId,
        user.subscription.cardDetails
      );
    } else {
      paymentResult = await paymentService.authorizePaypalPayment(
        "14.99",
        "GBP",
        "Unistudents Match Subscription"
      );
    }

    if (paymentResult.status !== "CREATED") {
      throw createError(400, "Payment authorization failed");
    }

    const subscriptionUpdate = {
      status: "active",
      lastPaymentDate: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paypalOrderId: paymentProcessor === "paypal" ? paymentResult.id : null,
      stripePaymentMethodId:
        paymentProcessor === "stripe" ? paymentResult.id : null,
      cardDetails: user.subscription.cardDetails,
    };

    await userService.updateUser(userId, {
      hasActiveSubscription: true,
      subscription: subscriptionUpdate,
    });

    logger.info(`Subscription successful for user: ${userId}`);
    res.status(200).json({
      message: "Subscription successful",
      hasActiveSubscription: true,
      paymentProcessor,
      paymentId: paymentResult.id,
    });
  } catch (error) {
    logger.error(`Subscription error: ${error.message}`);
    next(error);
  }
};

const cancelSubscription = async (req, res, next) => {
  try {
    const { userId } = req.user;

    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    if (user.subscription.status === "inactive") {
      throw createError(400, "No active subscription to cancel");
    }

    await userService.updateUser(userId, {
      hasActiveSubscription: false,
      subscription: {
        status: "inactive",
        trialStartDate: null,
        trialEndDate: null,
        lastPaymentDate: null,
        nextBillingDate: null,
        paypalOrderId: null,
        stripePaymentMethodId: null,
        cardDetails: user.subscription.cardDetails,
      },
    });

    logger.info(`Subscription cancelled for user: ${userId}`);
    res.status(200).json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    logger.error(`Cancel subscription error: ${error.message}`);
    next(error);
  }
};

module.exports = { register, login, subscribe, cancelSubscription };
