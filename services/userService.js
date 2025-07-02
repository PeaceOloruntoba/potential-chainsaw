const bcrypt = require("bcryptjs");
const { getDB } = require("../config/db");
const { moderateContent } = require("./moderationService");
const logger = require("../utils/logger");

const findUserByEmail = async (email) => {
  try {
    const db = getDB();
    return await db.collection("users").findOne({ email });
  } catch (error) {
    logger.error(`findUserByEmail error: ${error.message}`);
    throw error;
  }
};

const findUserById = async (id) => {
  try {
    const db = getDB();
    const { ObjectId } = require("mongodb");
    return await db.collection("users").findOne({ _id: new ObjectId(id) });
  } catch (error) {
    logger.error(`findUserById error: ${error.message}`);
    throw error;
  }
};

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

const updateUser = async (id, updateData) => {
  try {
    const db = getDB();
    const { ObjectId } = require("mongodb");
    const result = await db
      .collection("users")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
    return result.value;
  } catch (error) {
    logger.error(`updateUser error: ${error.message}`);
    throw error;
  }
};

module.exports = { findUserByEmail, findUserById, createUser, updateUser };
