class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const createError = (status, message, details) => {
  return new AppError(status, message, details);
};

module.exports = { createError, AppError };
