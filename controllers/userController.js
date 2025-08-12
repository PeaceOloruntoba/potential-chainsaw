const userService = require("../services/userService");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const photoController = require("./photoController");
const { moderateContent } = require("../services/moderationService");

const getDashboardUsers = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "Authenticated user not found.");
    }

    const oppositeGender = user.gender === "male" ? "female" : "male";

    const users = await userService.getNonAdminUsersByGender(oppositeGender);

    const moderatedUsers = await Promise.all(
      users.map(async (u) => ({
        id: u._id.toString(),
        firstName: await moderateContent(u.firstName),
        lastName: await moderateContent(u.lastName),
        age: u.age,
        gender: u.gender,
        university: u.university,
        status: u.status,
        description: await moderateContent(u.description),
        lookingFor: await moderateContent(u.lookingFor),
      }))
    );

    res.status(200).json(moderatedUsers);
  } catch (error) {
    logger.error(`Error fetching dashboard users: ${error.message}`);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    logger.info(`Fetching profile for userId: ${userId}`);
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User profile not found.");
    }

    const moderatedUser = {
      email: user.email,
      firstName: await moderateContent(user.firstName),
      lastName: await moderateContent(user.lastName),
      age: user.age,
      gender: user.gender,
      university: user.university,
      status: user.status,
      description: await moderateContent(user.description),
      lookingFor: await moderateContent(user.lookingFor),
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
      isAdmin: user.isAdmin,
      hasActiveSubscription: user.hasActiveSubscription,
    };

    res.status(200).json(moderatedUser);
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
    let {
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

    firstName = await moderateContent(firstName);
    lastName = await moderateContent(lastName);
    description = await moderateContent(description);
    lookingFor = await moderateContent(lookingFor);

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
