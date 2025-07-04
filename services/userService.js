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

    if (!ObjectId.isValid(userId)) {
      logger.warn(`findUserById: Invalid userId format provided: ${userId}`);
      return null;
    }
    return await db.collection("users").findOne({ _id: new ObjectId(userId) });
  } catch (error) {
    logger.error(`findUserById error for userId ${userId}: ${error.message}`);
    throw error;
  }
};

// Renamed and modified to include isAdmin: false filter
const getNonAdminUsersByGender = async (gender) => {
  try {
    const db = getDB();
    return await db
      .collection("users")
      .find({
        gender,
        hasActiveSubscription: true,
        isAdmin: false,
      })
      .toArray();
  } catch (error) {
    logger.error(`getNonAdminUsersByGender error: ${error.message}`);
    throw error;
  }
};

const updateUser = async (userId, userData) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(userId)) {
      logger.error(`updateUser: Invalid userId format provided: ${userId}`);
      throw createError(400, "Invalid user ID format.");
    }

    const moderatedData = {
      description:
        userData.description !== undefined
          ? await moderateContent(userData.description)
          : undefined,
      lookingFor:
        userData.lookingFor !== undefined
          ? await moderateContent(userData.lookingFor)
          : undefined,
      updatedAt: new Date(),
    };

    const finalUpdateData = Object.fromEntries(
      Object.entries(moderatedData).filter(
        ([key, value]) => value !== undefined
      )
    );

    const updatePayload = { ...userData, ...finalUpdateData };

    delete updatePayload.description;
    delete updatePayload.lookingFor;

    const result = await db
      .collection("users")
      .findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: updatePayload },
        { returnDocument: "after" }
      );
    if (!result.value) {
      throw createError(404, "User not found");
    }
    return result.value;
  } catch (error) {
    logger.error(`updateUser error for userId ${userId}: ${error.message}`);
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
  getNonAdminUsersByGender,
  updateUser,
  getAllUsers,
};
