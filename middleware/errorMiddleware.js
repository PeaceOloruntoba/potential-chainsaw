const logger = require("../utils/logger");

const errorHandler = (error, req, res, next) => {
  logger.error(`Error: ${error.message}, Stack: ${error.stack}`);
  const status = error.status || 500;
  res.status(status).json({
    error: {
      message: error.message || "Internal Server Error",
      status,
    },
  });
};

module.exports = { errorHandler };
