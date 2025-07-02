const bcrypt = require("bcrypt");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { notifyGuardian } = require("../services/notificationService");

const createProfile = async (req, res, next) => {
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
    } = req.body;

    if (password !== confirmPassword) {
      throw createError(400, "Passwords do not match");
    }

    const db = getDB();
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) throw createError(400, "User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
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
      subscription: { status: "trial", startDate: new Date() },
      ...(gender === "female"
        ? { guardian: { email: guardianEmail, phone: guardianPhone } }
        : {}),
      isAdmin: false,
    };

    const result = await db.collection("users").insertOne(user);

    if (gender === "female" && guardianEmail && guardianPhone) {
      await notifyGuardian(
        { email: guardianEmail, phone: guardianPhone },
        {
          message: "New profile created by admin",
          userId: result.insertedId,
        }
      );
    }

    logger.info(`Admin created profile: ${email}`);
    res.status(201).json({ userId: result.insertedId });
  } catch (error) {
    next(error);
  }
};

const getAllProfiles = async (req, res, next) => {
  try {
    const db = getDB();
    const profiles = await db.collection("users").find().toArray();
    res.json(profiles);
  } catch (error) {
    next(error);
  }
};

module.exports = { createProfile, getAllProfiles };
