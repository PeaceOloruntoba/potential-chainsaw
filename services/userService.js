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
      createdAt: userData.createdAt || new Date(),
      updatedAt: userData.updatedAt || new Date(),
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
    if (!ObjectId.isValid(userId)) {
      logger.warn(
        `findUserById: Invalid userId format provided: ${userId}. Returning null.`
      );
      return null;
    }
    const db = getDB();
    const objectId = new ObjectId(userId);
    return await db.collection("users").findOne({ _id: objectId });
  } catch (error) {
    logger.error(`findUserById error for userId ${userId}: ${error.message}`);
    throw error;
  }
};

const findUserByStripeCustomerId = async (stripeCustomerId) => {
  try {
    const db = getDB();
    return await db
      .collection("users")
      .findOne({ "subscription.stripeCustomerId": stripeCustomerId });
  } catch (error) {
    logger.error(
      `findUserByStripeCustomerId error for customerId ${stripeCustomerId}: ${error.message}`
    );
    throw error;
  }
};

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
    if (!ObjectId.isValid(userId)) {
      logger.error(
        `updateUser: Invalid userId format provided: ${userId}. Throwing 400 error.`
      );
      throw createError(400, "Invalid user ID format.");
    }

    const db = getDB();
    const objectId = new ObjectId(userId);

    const updateFields = {
      ...userData,
      updatedAt: new Date(),
    };

    if (updateFields.description !== undefined) {
      updateFields.description = await moderateContent(
        updateFields.description
      );
    }
    if (updateFields.lookingFor !== undefined) {
      updateFields.lookingFor = await moderateContent(updateFields.lookingFor);
    }

    if (updateFields.password) {
      delete updateFields.password;
    }

    const result = await db
      .collection("users")
      .findOneAndUpdate(
        { _id: objectId },
        { $set: updateFields },
        { returnDocument: "after" }
      );

    if (!result.value) {
      logger.error(
        `updateUser: No user found with _id ${objectId.toHexString()} for update.`
      );
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
  findUserByStripeCustomerId,
  getNonAdminUsersByGender,
  updateUser,
  getAllUsers,
};
