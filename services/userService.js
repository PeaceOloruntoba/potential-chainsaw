const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const { moderateContent } = require("./moderationService");
const logger = require("../utils/logger");
const { ObjectId } = require("mongodb");

const createUser = async (userData) => {
  try {
    const db = getDB();
    const moderatedData = {
      ...userData,
      description: await moderateContent(userData.description),
      lookingFor: await moderateContent(userData.lookingFor),
      createdAt: new Date(),
    };
    const result = await db.collection("users").insertOne(moderatedData);
    return { _id: result.insertedId, ...moderatedData };
  } catch (error) {
    logger.error(`createUser error: ${error.message}`);
    throw error;
  }
};

const findUserByEmail = async (email) => {
  try {
    const db = getDB();
    return await db.collection("users").findOne({ email });
  } catch (error) {
    logger.error(`findUserByEmail error: ${error.message}`);
    throw error;
  }
};

const findUserById = async (userId) => {
  try {
    const db = getDB();
    return await db.collection("users").findOne({ _id: new ObjectId(userId) });
  } catch (error) {
    logger.error(`findUserById error: ${error.message}`);
    throw error;
  }
};

const getUsersByGender = async (gender) => {
  try {
    const db = getDB();
    return await db
      .collection("users")
      .find({ gender, hasActiveSubscription: true })
      .toArray();
  } catch (error) {
    logger.error(`getUsersByGender error: ${error.message}`);
    throw error;
  }
};

const updateUser = async (userId, userData) => {
  try {
    const db = getDB();
    const moderatedData = {
      ...userData,
      description: await moderateContent(userData.description),
      lookingFor: await moderateContent(userData.lookingFor),
      updatedAt: new Date(),
    };
    const result = await db
      .collection("users")
      .findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: moderatedData },
        { returnDocument: "after" }
      );
    if (!result.value) {
      throw createError(404, "User not found");
    }
    return result.value;
  } catch (error) {
    logger.error(`updateUser error: ${error.message}`);
    throw error;
  }
};

const getAllUsers = async () => {
  try {
    const db = getDB();
    return await db.collection("users").find({}).toArray();
  } catch (error) {
    logger.error(`getAllUsers error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getUsersByGender,
  updateUser,
  getAllUsers,
};
