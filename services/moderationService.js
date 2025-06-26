const Filter = require("bad-words");
const filter = new Filter();
const logger = require("../utils/logger");

const moderateContent = (content, isPhoto = false) => {
  try {
    if (isPhoto) {
      // Placeholder for image moderation (e.g., Google Cloud Vision)
      logger.info("Photo moderation placeholder");
      return content;
    }
    return filter.clean(content);
  } catch (error) {
    logger.error(`Content moderation error: ${error.message}`);
    throw error;
  }
};

module.exports = { moderateContent };
