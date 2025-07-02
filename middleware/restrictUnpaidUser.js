const userService = require("../services/userService");
const logger = require("../utils/logger");

const restrictUnpaidUsers = async (req, res, next) => {
  try {
    const { userId } = req.user; // From auth middleware
    const user = await userService.findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    if (!user.hasActiveSubscription) {
      return res
        .status(402)
        .json({
          error: { message: "Payment required to access this resource" },
        });
    }

    next();
  } catch (error) {
    logger.error(`restrictUnpaidUsers middleware error: ${error.message}`);
    next(error);
  }
};

module.exports = restrictUnpaidUsers;
