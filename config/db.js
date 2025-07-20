const { MongoClient } = require("mongodb");
const logger = require("../utils/logger");

let db;

const connectDB = async () => {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,serverSelectionTimeoutMS: 30000, // 30s timeout
      socketTimeoutMS: 45000, // 45s socket timeout
    });
    db = client.db("unistudentsmatch");
    logger.info("Connected to MongoDB");
    return db;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const getDB = () => {
  if (!db) throw new Error("Database not initialized");
  return db;
};

module.exports = { connectDB, getDB };
