const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

// Use dynamic import to load bad-words as an ES module
let Filter;

(async () => {
  try {
    const badWords = await import("bad-words");
    Filter = badWords.default || badWords.Filter;
  } catch (error) {
    logger.error(`Failed to load bad-words module: ${error.message}`);
    throw error;
  }
})();

// Initialize the bad-words filter
let filter;
const initializeFilter = () => {
  if (!Filter) {
    throw createError(500, "Bad-words module not loaded");
  }
  if (!filter) {
    filter = new Filter();
  }
  return filter;
};

const moderateContent = async (content) => {
  try {
    if (!content || typeof content !== "string") {
      logger.warn("Invalid content provided for moderation");
      return content || "";
    }

    const badWordsFilter = initializeFilter();
    const cleanedContent = badWordsFilter.clean(content);
    logger.info("Content moderated successfully");
    return cleanedContent;
  } catch (error) {
    logger.error(`Content moderation error: ${error.message}`);
    throw createError(500, "Bad-words module error", error.message);
  }
};

module.exports = { moderateContent };
