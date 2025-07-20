const userService = require("../services/userService");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const photoController = require("./photoController");

const getDashboardUsers = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "Authenticated user not found.");
    }

    const oppositeGender = user.gender === "male" ? "female" : "male";

    const users = await userService.getNonAdminUsersByGender(oppositeGender);

    res.status(200).json(
      users.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        age: u.age,
        gender: u.gender,
        university: u.university,
        status: u.status,
        description: u.description,
        lookingFor: u.lookingFor,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching dashboard users: ${error.message}`);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User profile not found.");
    }
    res.status(200).json({
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
    logger.error(
      `Error fetching profile for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
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
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !university ||
      !status ||
      !description ||
      !lookingFor
    ) {
      throw createError(400, "All required profile fields must be provided.");
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian email and phone are required for female users."
      );
    }

    const updatedData = {
      firstName,
      lastName,
      age: parseInt(age),
      gender,
      university,
      status,
      description,
      lookingFor,
      ...(gender === "female" && guardianEmail && { guardianEmail }),
      ...(gender === "female" && guardianPhone && { guardianPhone }),
    };

    const user = await userService.updateUser(userId, updatedData);

    res.status(200).json({
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
    logger.error(
      `Error updating profile for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

module.exports = {
  getDashboardUsers,
  getProfile,
  updateProfile,

  getSingleUserProfileWithPhotos:
    photoController.getSingleUserProfileWithPhotos,
};
