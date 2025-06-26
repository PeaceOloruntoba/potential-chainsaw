const bcrypt = require("bcrypt");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { notifyGuardian } = require("../services/notificationService");

const createProfile = async (req, res, next) => {
  try {
    const {
      email,
      password,
      name,
      age,
      gender,
      university,
      status,
      description,
      lookingFor,
      guardian,
    } = req.body;

    const db = getDB();
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) throw createError(400, "User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      email,
      password: hashedPassword,
      name,
      age,
      gender,
      university,
      status,
      description,
      lookingFor,
      subscription: { status: "trial", startDate: new Date() },
      ...(gender === "female" ? { guardian } : {}),
      isAdmin: false,
    };

    const result = await db.collection("users").insertOne(user);

    if (gender === "female" && guardian) {
      await notifyGuardian(guardian, {
        message: "New profile created by admin",
        userId: result.insertedId,
      });
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
