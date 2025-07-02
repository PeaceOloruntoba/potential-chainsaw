const { createError } = require("../utils/errorHandler");
const userService = require("../services/userService");
const logger = require("../utils/logger");
const bcrypt = require("bcryptjs");

const createUser = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin.isAdmin) {
      throw createError(403, "Unauthorized: Admin access required");
    }

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
      isAdmin,
      hasActiveSubscription,
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
      throw createError(400, "All required fields must be provided");
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian email and phone are required for female users"
      );
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
      isAdmin: isAdmin || false,
      hasActiveSubscription: hasActiveSubscription || false,
      subscription: {
        status: hasActiveSubscription ? "active" : "trial",
        trialStartDate: hasActiveSubscription ? null : new Date(),
        trialEndDate: hasActiveSubscription
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: hasActiveSubscription ? new Date() : null,
        nextBillingDate: hasActiveSubscription
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        paypalOrderId: null,
        stripePaymentMethodId: null,
        cardDetails: null,
      },
    };

    const user = await userService.createUser(userData);
    res.status(201).json({ userId: user._id, email: user.email });
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`);
    next(error);
  }
};

const getAllProfiles = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin.isAdmin) {
      throw createError(403, "Unauthorized: Admin access required");
    }

    const users = await userService.getAllUsers();
    res.status(200).json(
      users.map((u) => ({
        id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        age: u.age,
        gender: u.gender,
        university: u.university,
        status: u.status,
        description: u.description,
        lookingFor: u.lookingFor,
        guardianEmail: u.guardianEmail,
        guardianPhone: u.guardianPhone,
        isAdmin: u.isAdmin,
        hasActiveSubscription: u.hasActiveSubscription,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching profiles: ${error.message}`);
    next(error);
  }
};

module.exports = { createUser, getAllProfiles };
