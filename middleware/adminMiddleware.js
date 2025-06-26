const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

const isAdmin = async (req, res, next) => {
  try {
    const db = getDB();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.user.id) });
    if (!user.isAdmin) throw createError(403, "Admin access required");
    next();
  } catch (error) {
    logger.error(`Admin middleware error: ${error.message}`);
    next(error);
  }
};

module.exports = { isAdmin };
