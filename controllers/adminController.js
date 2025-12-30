const { createError } = require("../utils/errorHandler");
const userService = require("../services/userService");
const logger = require("../utils/logger");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");

const createUser = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin || !admin.isAdmin) {
      throw createError(403, "Unauthorized: Admin access required");
    }

    const {
      email,
      password,
      firstName,
      lastName,
      age,
      gender,
      hear,
      university,
      isStudent,
      isGraduate,
      description,
      lookingFor,
      guardianEmail,
      guardianPhone,
      isAdmin,
    } = req.body;

    if (
      !email ||
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !university ||
      !description ||
      !lookingFor
    ) {
      throw createError(400, "All required fields must be provided");
    }

    if (gender === "Female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian email and phone are required for female users"
      );
    }

    if (isStudent && isGraduate) {
      throw createError(400, "User cannot be both a student and a graduate.");
    }
    if (!isStudent && !isGraduate) {
      throw createError(
        400,
        "Please specify if the user is a student or a graduate."
      );
    }

    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      throw createError(400, "Email already exists");
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash("password", 10);

    // 🔥 Permanent subscription for admin-created users
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
      hear,
      guardianEmail: gender === "Female" ? guardianEmail : undefined,
      guardianPhone: gender === "Female" ? guardianPhone : undefined,
      isAdmin: isAdmin || false,
      hasActiveSubscription: true,
      subscription: {
        status: "active",
        trialStartDate: new Date(),
        trialEndDate: new Date("9999-12-31T23:59:59.999Z"),
        lastPaymentDate: new Date(),
        nextBillingDate: new Date("9999-12-31T23:59:59.999Z"),
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

    res.status(201).json({
      id: user._id.toString(),
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
      hear: user.hear,
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
      isAdmin: user.isAdmin,
      hasActiveSubscription: user.hasActiveSubscription,
      subscription: user.subscription,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    logger.error(`Error creating user by admin: ${error.message}`);
    next(error);
  }
};

const getAllProfiles = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin || !admin.isAdmin) {
      throw createError(403, "Unauthorized: Admin access required");
    }

    const users = await userService.getAllUsers();
    res.status(200).json(
      users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        age: u.age,
        gender: u.gender,
        university: u.university,
        isStudent: u.isStudent,
        isGraduate: u.isGraduate,
        description: u.description,
        lookingFor: u.lookingFor,
        hear: u.hear,
        guardianEmail: u.guardianEmail,
        guardianPhone: u.guardianPhone,
        isAdmin: u.isAdmin,
        hasActiveSubscription: u.hasActiveSubscription,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching profiles for admin: ${error.message}`);
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin || !admin.isAdmin) {
      throw createError(403, "Unauthorized: Admin access required");
    }

    const { id: profileId } = req.params;
    if (!ObjectId.isValid(profileId)) {
      throw createError(400, "Invalid profile ID format.");
    }

    const {
      firstName,
      lastName,
      age,
      gender,
      university,
      isStudent,
      isGraduate,
      description,
      lookingFor,
      guardianEmail,
      guardianPhone,
      isAdmin,
      hear,
      hasActiveSubscription,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !university ||
      !description ||
      !lookingFor
    ) {
      throw createError(400, "All required fields must be provided for update");
    }

    if (gender === "Female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian email and phone are required for female users"
      );
    }

    if (isStudent && isGraduate) {
      throw createError(400, "User cannot be both a student and a graduate.");
    }
    if (!isStudent && !isGraduate) {
      throw createError(
        400,
        "Please specify if the user is a student or a graduate."
      );
    }

    const updateData = {
      firstName,
      lastName,
      age: parseInt(age),
      gender,
      university,
      isStudent,
      isGraduate,
      description,
      lookingFor,
      isAdmin,
      hear,
      hasActiveSubscription,
      guardianEmail: gender === "Female" ? guardianEmail : null,
      guardianPhone: gender === "Female" ? guardianPhone : null,
    };

    const updatedUser = await userService.updateUser(profileId, updateData);

    res.status(200).json({
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      age: updatedUser.age,
      gender: updatedUser.gender,
      university: updatedUser.university,
      isStudent: updatedUser.isStudent,
      isGraduate: updatedUser.isGraduate,
      description: updatedUser.description,
      lookingFor: updatedUser.lookingFor,
      guardianEmail: updatedUser.guardianEmail,
      guardianPhone: updatedUser.guardianPhone,
      isAdmin: updatedUser.isAdmin,
      hear: updatedUser.hear,
      hasActiveSubscription: updatedUser.hasActiveSubscription,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error) {
    logger.error(`Error updating profile by admin: ${error.message}`);
    next(error);
  }
};

module.exports = { createUser, getAllProfiles, updateProfile };
