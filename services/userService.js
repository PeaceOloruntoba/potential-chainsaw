const User = require("../models/User");
const { moderateContent } = require("./moderationService");

const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

const findUserById = async (id) => {
  return await User.findById(id);
};

const createUser = async (userData) => {
  const moderatedData = {
    ...userData,
    description: await moderateContent(userData.description),
    lookingFor: await moderateContent(userData.lookingFor),
  };
  return await User.create(moderatedData);
};

const updateUser = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

module.exports = { findUserByEmail, findUserById, createUser, updateUser };
