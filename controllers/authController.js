const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { jwtSecret } = require("../config");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

const register = async (req, res, next) => {
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
    const token = jwt.sign({ id: result.insertedId }, jwtSecret, {
      expiresIn: "30d",
    });

    if (gender === "female" && guardian) {
      await require("../services/notificationService").notifyGuardian(
        guardian,
        {
          message: "New user registered",
          userId: result.insertedId,
        }
      );
    }

    logger.info(`User registered: ${email}`);
    res.status(201).json({ token, userId: result.insertedId });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDB();
    const user = await db.collection("users").findOne({ email });
    if (!user) throw createError(400, "Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw createError(400, "Invalid credentials");

    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "30d" });
    logger.info(`User logged in: ${email}`);
    res.json({ token, userId: user._id });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };
