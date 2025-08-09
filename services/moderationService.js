// services/moderationService.js
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

// Use dynamic import for bad-words
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

// Use dynamic import for emoji-regex
let emojiRegex;

(async () => {
  try {
    const emojiRegexModule = await import("emoji-regex");
    emojiRegex = emojiRegexModule.default || emojiRegexModule;
    logger.info("Emoji-regex module loaded successfully.");
  } catch (error) {
    logger.error(`Failed to load emoji-regex module: ${error.message}`);
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

// New function to remove emojis
const removeEmojis = (text) => {
  if (!emojiRegex) {
    logger.warn("Emoji-regex module not loaded, skipping emoji removal.");
    return text;
  }
  const regex = emojiRegex();
  return text.replace(regex, "");
};

const moderateContent = async (content) => {
  try {
    if (!content || typeof content !== "string") {
      logger.warn(
        "Invalid or empty content provided for moderation, returning as is."
      );
      return content || "";
    }

    // 1. Remove all emojis from the content
    const contentWithoutEmojis = removeEmojis(content);

    // 2. Filter out bad words from the emoji-less content
    const badWordsFilter = getFilterInstance();
    const cleanedContent = badWordsFilter.clean(contentWithoutEmojis);

    return cleanedContent;
  } catch (error) {
    logger.error(`Content moderation error: ${error.message}`);
    throw createError(500, "Content moderation failed", error.message);
  }
};

module.exports = { moderateContent };
