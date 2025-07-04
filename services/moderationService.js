// services/moderationService.js
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

// Use dynamic import to load bad-words as an ES module
let Filter;

(async () => {
  try {
    const badWords = await import("bad-words");
    Filter = badWords.default || badWords.Filter;
    logger.info("Bad-words module loaded successfully.");
  } catch (error) {
    logger.error(`Failed to load bad-words module: ${error.message}`);
    throw error;
  }
})();

let filterInstance;
const getFilterInstance = () => {
  if (!Filter) {
    logger.error("Bad-words Filter class is not initialized.");
    throw createError(500, "Bad-words module not loaded");
  }
  if (!filterInstance) {
    filterInstance = new Filter();
  }
  return filterInstance;
};

const moderateContent = async (content) => {
  try {
    if (!content || typeof content !== "string") {
      logger.warn(
        "Invalid or empty content provided for moderation, returning as is."
      );
      return content || "";
    }

    const badWordsFilter = getFilterInstance();
    const cleanedContent = badWordsFilter.clean(content);
    return cleanedContent;
  } catch (error) {
    logger.error(`Content moderation error: ${error.message}`);
    throw createError(500, "Content moderation failed", error.message);
  }
};

module.exports = { moderateContent };
