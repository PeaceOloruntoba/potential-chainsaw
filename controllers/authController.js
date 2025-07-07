const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userService = require("../services/userService");
const paymentService = require("../services/paymentService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");
const { createError } = require("../utils/errorHandler");
const paypal = require("@paypal/checkout-server-sdk");

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
      throw createError(400, "All required fields must be provided.");
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian details (email and phone) are required for female users."
      );
    }

    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      throw createError(
        400,
        "Email already exists. Please use a different email or login."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let isStudent = false;
    let isGraduate = false;
    if (status === "student") {
      isStudent = true;
    } else if (status === "graduate") {
      isGraduate = true;
    } else {
      throw createError(
        400,
        "Invalid user status provided. Must be 'student' or 'graduate'."
      );
    }

    const trialStartDate = new Date();
    const trialEndDate = new Date(
      trialStartDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      age: parseInt(age),
      gender,
      university,
      isStudent,
      isGraduate,
      description,
      lookingFor,
      ...(gender === "female" && { guardianEmail }),
      ...(gender === "female" && { guardianPhone }),
      isAdmin: false,
      hasActiveSubscription: false,
      subscription: {
        status: "trial",
        trialStartDate: trialStartDate,
        trialEndDate: trialEndDate,
        lastPaymentDate: null,
        nextBillingDate: null,
        paypalOrderId: null,
        paypalSubscriptionId: null,
        stripeCustomerId: null,
        stripePaymentMethodId: null,
        stripeSubscriptionId: null,
        cardDetails: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = await userService.createUser(userData);

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, isAdmin: user.isAdmin },
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
    res.status(201).json({ token, userId: user._id.toString() });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, "Email and password are required.");
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      throw createError(401, "Invalid credentials.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError(401, "Invalid credentials.");
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logger.info(`User logged in: ${email}`);
    res.status(200).json({
      token,
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      age: user.age,
      gender: user.gender,
      university: user.university,
      isStudent: user.isStudent,
      isGraduate: user.isGraduate,
      description: user.description,
      lookingFor: user.lookingFor,
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
      isAdmin: user.isAdmin,
      hasActiveSubscription: user.hasActiveSubscription,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      subscriptionStatus: user.subscription?.status || "inactive",
      trialEndDate: user.subscription?.trialEndDate || null,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

const subscribe = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const {
      paymentProcessor,
      paypalSubscriptionId,
      stripePaymentMethodId: stripePaymentMethodIdFromFrontend,
    } = req.body;

    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User not found.");
    }

    if (
      user.hasActiveSubscription &&
      user.subscription &&
      user.subscription.status === "active"
    ) {
      throw createError(400, "User already has an active subscription.");
    }

    if (paymentProcessor === "paypal") {
      if (!paypalSubscriptionId) {
        throw createError(
          400,
          "PayPal Subscription ID is required for recurring payment."
        );
      }
      try {
        const subscriptionUpdate = {
          status: "active",
          trialStartDate: user.subscription?.trialStartDate || null,
          trialEndDate: user.subscription?.trialEndDate || null,
          lastPaymentDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paypalOrderId: null,
          paypalSubscriptionId: paypalSubscriptionId,
          stripeCustomerId: null,
          stripePaymentMethodId: null,
          stripeSubscriptionId: null,
          cardDetails: null,
        };

        await userService.updateUser(userId, {
          hasActiveSubscription: true,
          subscription: subscriptionUpdate,
        });

        logger.info(
          `PayPal recurring subscription successful for user: ${userId}`
        );
        res.status(200).json({
          message: "Recurring subscription successful via PayPal",
          hasActiveSubscription: true,
          paymentId: paypalSubscriptionId,
        });
        return;
      } catch (paypalError) {
        logger.error(
          `PayPal recurring subscription error: ${paypalError.message}`
        );
        throw createError(
          400,
          `PayPal subscription failed: ${paypalError.message}`
        );
      }
    }

    if (paymentProcessor === "stripe") {
      let customerId = user.subscription?.stripeCustomerId;
      let paymentMethodIdToUse = stripePaymentMethodIdFromFrontend;

      if (!customerId || stripePaymentMethodIdFromFrontend) {
        try {
          const {
            customerId: newCustomerId,
            paymentMethodId: newPaymentMethodId,
          } = await paymentService.createStripeCustomerAndPaymentMethod(
            user.email,
            stripePaymentMethodIdFromFrontend
          );
          customerId = newCustomerId;
          paymentMethodIdToUse = newPaymentMethodId;
        } catch (stripeError) {
          logger.error(
            `Stripe customer/payment method creation/attachment failed: ${stripeError.message}`
          );
          throw createError(400, "Failed to process Stripe payment details.");
        }
      }

      if (!customerId || !paymentMethodIdToUse) {
        throw createError(
          400,
          "Stripe customer or payment method not available."
        );
      }

      const subscription = await paymentService.createStripeSubscription(
        customerId,
        paymentMethodIdToUse
      );

      if (
        subscription.status !== "active" &&
        subscription.status !== "trialing"
      ) {
        throw createError(
          400,
          `Stripe subscription failed with status: ${subscription.status}`
        );
      }

      const subscriptionUpdate = {
        status: "active",
        trialStartDate: user.subscription?.trialStartDate || null,
        trialEndDate: user.subscription?.trialEndDate || null,
        lastPaymentDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paypalOrderId: null,
        paypalSubscriptionId: null,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodIdToUse,
        stripeSubscriptionId: subscription.id,
        cardDetails: null,
      };

      await userService.updateUser(userId, {
        hasActiveSubscription: true,
        subscription: subscriptionUpdate,
      });

      logger.info(`Stripe subscription successful for user: ${userId}`);
      res.status(200).json({
        message: "Subscription successful via Stripe",
        hasActiveSubscription: true,
        paymentId: subscription.id,
      });
      return;
    }

    throw createError(400, "Invalid payment processor specified.");
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
      throw createError(404, "User not found.");
    }

    if (
      !user.hasActiveSubscription ||
      !user.subscription ||
      user.subscription.status === "inactive"
    ) {
      throw createError(400, "No active subscription to cancel.");
    }

    if (user.subscription.stripeSubscriptionId) {
      try {
        await paymentService.cancelStripeSubscription(
          user.subscription.stripeSubscriptionId
        );
        logger.info(
          `Stripe subscription ${user.subscription.stripeSubscriptionId} scheduled for cancellation at period end.`
        );
      } catch (stripeError) {
        logger.error(
          `Failed to schedule Stripe subscription cancellation: ${stripeError.message}`
        );
        throw createError(
          500,
          "Failed to cancel subscription with payment provider. Please try again."
        );
      }
    }

    if (user.subscription.paypalSubscriptionId) {
      try {
        await paymentService.cancelPaypalSubscription(
          user.subscription.paypalSubscriptionId
        );
        logger.info(
          `PayPal subscription ${user.subscription.paypalSubscriptionId} scheduled for cancellation.`
        );
      } catch (paypalError) {
        logger.error(
          `Failed to schedule PayPal subscription cancellation: ${paypalError.message}`
        );
        throw createError(
          500,
          "Failed to cancel subscription with payment provider. Please try again."
        );
      }
    }

    await userService.updateUser(userId, {
      hasActiveSubscription: false,
      subscription: {
        ...user.subscription,
        status: "pending_cancellation",
        nextBillingDate: null,
      },
    });

    logger.info(`Subscription cancellation initiated for user: ${userId}`);
    res
      .status(200)
      .json({
        message:
          "Subscription cancellation initiated. Your access will remain until the end of the current billing period.",
      });
  } catch (error) {
    logger.error(`Cancel subscription error: ${error.message}`);
    next(error);
  }
};

module.exports = { register, login, subscribe, cancelSubscription };
