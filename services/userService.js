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
    logger.debug(
      `findUserById: Attempting to find user with userId (string): ${userId}`
    );
    if (!ObjectId.isValid(userId)) {
      logger.warn(
        `findUserById: Invalid userId format provided: ${userId}. Returning null.`
      );
      return null;
    }
    const db = getDB();
    const objectId = new ObjectId(userId);
    logger.debug(
      `findUserById: Converted userId to ObjectId: ${objectId.toHexString()}`
    );
    return await db.collection("users").findOne({ _id: objectId });
  } catch (error) {
    logger.error(`findUserById error for userId ${userId}: ${error.message}`);
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
    logger.debug(
      `updateUser: Attempting to update user with userId (string): ${userId}`
    );
    if (!ObjectId.isValid(userId)) {
      logger.error(
        `updateUser: Invalid userId format provided: ${userId}. Throwing 400 error.`
      );
      throw createError(400, "Invalid user ID format.");
    }

    const db = getDB();
    const objectId = new ObjectId(userId);
    logger.debug(
      `updateUser: Converted userId to ObjectId for query: ${objectId.toHexString()}`
    );

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

    logger.debug(
      `updateUser: Update payload for $set: ${JSON.stringify(updatePayload)}`
    );

    const result = await db
      .collection("users")
      .findOneAndUpdate(
        { _id: objectId },
        { $set: updatePayload },
        { returnDocument: "after" }
      );

    if (!result) {
      logger.error(
        `updateUser: No user found with _id ${objectId.toHexString()} for update.`
      );
      throw createError(404, "User not found");
    }
    logger.info(
      `updateUser: Successfully updated user ${objectId.toHexString()}.`
    );
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
