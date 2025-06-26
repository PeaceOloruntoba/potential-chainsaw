const logger = require("../utils/logger");

const notifyGuardian = async (guardian, messageDetails) => {
  try {
    // Placeholder for email/SMS service (e.g., SendGrid, Twilio)
    logger.info(
      `Guardian notification sent to ${guardian.email}, ${
        guardian.phone
      }: ${JSON.stringify(messageDetails)}`
    );
    // Implement actual notification logic here
  } catch (error) {
    logger.error(`Guardian notification error: ${error.message}`);
    throw error;
  }
};

module.exports = { notifyGuardian };
