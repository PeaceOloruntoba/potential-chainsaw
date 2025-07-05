const { createError } = require("../utils/errorHandler");
const userService = require("../services/userService");
const logger = require("../utils/logger");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb"); // Import ObjectId

const createUser = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const admin = await userService.findUserById(userId);
    if (!admin || !admin.isAdmin) {
      // Ensure admin exists and has isAdmin true
      throw createError(403, "Unauthorized: Admin access required");
    }

    const {
      email,
      password, // Password is optional for admin creation, but we'll hash if provided
      firstName,
      lastName,
      age,
      gender,
      university,
      isStudent, // Use isStudent/isGraduate for status
      isGraduate,
      description,
      lookingFor,
      guardianEmail,
      guardianPhone,
      isAdmin, // This comes from the admin form
    } = req.body;

    // Basic validation for required fields
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

    let hashedPassword = password ? await bcrypt.hash(password, 10) : undefined; // Hash if password is provided

    const userData = {
      email,
      password: hashedPassword, // Will be undefined if no password provided
      firstName,
      lastName,
      age: parseInt(age),
      gender,
      university,
      isStudent, // Directly use boolean flags
      isGraduate, // Directly use boolean flags
      description,
      lookingFor,
      guardianEmail: gender === "Female" ? guardianEmail : undefined,
      guardianPhone: gender === "Female" ? guardianPhone : undefined,
      isAdmin: isAdmin || false, // Use isAdmin from payload, default to false
      hasActiveSubscription: false, // New users start without active subscription
      subscription: {
        status: "trial", // New users start on trial
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: null,
        nextBillingDate: null,
        paypalOrderId: null,
        stripePaymentMethodId: null,
        cardDetails: null, // Card details are typically added by the user themselves later
      },
      createdAt: new Date(), // Set creation timestamp
      updatedAt: new Date(), // Set initial update timestamp
    };

    const user = await userService.createUser(userData);
    res.status(201).json({
      id: user._id.toString(), // Ensure ID is string
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
        id: u._id.toString(), // Ensure ID is string
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        age: u.age,
        gender: u.gender,
        university: u.university,
        isStudent: u.isStudent, // Include these
        isGraduate: u.isGraduate, // Include these
        description: u.description,
        lookingFor: u.lookingFor,
        guardianEmail: u.guardianEmail,
        guardianPhone: u.guardianPhone,
        isAdmin: u.isAdmin,
        hasActiveSubscription: u.hasActiveSubscription,
        createdAt: u.createdAt, // Include timestamp
        updatedAt: u.updatedAt, // Include timestamp
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

    const { id: profileId } = req.params; // The ID of the profile to update
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
      isAdmin, // Admin can update this
      hasActiveSubscription, // Admin can update this
    } = req.body;

    // Validate required fields for update (adjust as per your needs for partial updates)
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
      isAdmin, // Directly use isAdmin from payload
      hasActiveSubscription, // Directly use hasActiveSubscription from payload
      // Conditionally set guardian details
      guardianEmail: gender === "Female" ? guardianEmail : null, // Set to null if gender changes to Male
      guardianPhone: gender === "Female" ? guardianPhone : null, // Set to null if gender changes to Male
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
