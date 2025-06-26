const { ObjectId } = require("mongodb");

const messageSchema = {
  senderId: ObjectId,
  receiverId: ObjectId,
  content: String,
  timestamp: Date,
  isPhoto: Boolean,
};

module.exports = messageSchema;
