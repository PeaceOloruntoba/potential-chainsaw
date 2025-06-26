const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { jwtSecret } = require("../config");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw createError(401, "No token provided");

    const decoded = jwt.verify(token, jwtSecret);
    const db = getDB();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(decoded.id) });
    if (!user) throw createError(401, "User not found");

    req.user = decoded;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    next(error);
  }
};

module.exports = { authenticate };
