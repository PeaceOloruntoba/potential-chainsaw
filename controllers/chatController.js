const { createError } = require("../utils/errorHandler");
const userService = require("../services/userService");
const logger = require("../utils/logger");

const getOppositeGenderUsers = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    const oppositeGender = user.gender === "male" ? "female" : "male";
    const users = await userService.getUsersByGender(oppositeGender);
    res.status(200).json(
      users.map((u) => ({
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        age: u.age,
        lookingFor: u.lookingFor,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.findUserById(userId);
    if (!user) {
      throw createError(404, "User not found");
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
    logger.error(`Error fetching profile: ${error.message}`);
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
      throw createError(400, "All required fields must be provided");
    }

    if (gender === "female" && (!guardianEmail || !guardianPhone)) {
      throw createError(
        400,
        "Guardian email and phone are required for female users"
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
      guardianEmail: gender === "female" ? guardianEmail : undefined,
      guardianPhone: gender === "female" ? guardianPhone : undefined,
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
    logger.error(`Error updating profile: ${error.message}`);
    next(error);
  }
};

module.exports = { getOppositeGenderUsers, getProfile, updateProfile };
