const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { getDB } = require("../config/db");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw createError(401, "No token provided");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.userId) throw createError(401, "Invalid token");

    const db = getDB();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(decoded.userId) });
    if (!user) throw createError(401, "User not found");

    req.user = { userId: user._id.toString() };
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    next(error);
  }
};

module.exports = { authenticate };
