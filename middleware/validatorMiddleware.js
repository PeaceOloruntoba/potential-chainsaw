const { validationResult } = require("express-validator");
const { createError } = require("../utils/errorHandler");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(400, "Validation failed", errors.array());
  }
  next();
};

module.exports = { validate };
