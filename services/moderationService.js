const logger = require("../utils/logger");

let Filter;

const loadBadWords = async () => {
  try {
    const module = await import("bad-words");
    Filter = module.default;
  } catch (error) {
    logger.error(`Failed to load bad-words module: ${error.message}`);
    throw error;
  }
};

// Initialize bad-words module
loadBadWords();

const moderateContent = async (content, isPhoto = false) => {
  try {
    if (isPhoto) {
      // Placeholder for image moderation (e.g., Google Cloud Vision)
      logger.info("Photo moderation placeholder");
      return content;
    }
    if (!Filter) {
      throw new Error("Bad-words module not initialized");
    }
    const filter = new Filter();
    return filter.clean(content);
  } catch (error) {
    logger.error(`Content moderation error: ${error.message}`);
    throw error;
  }
};

module.exports = { moderateContent };
