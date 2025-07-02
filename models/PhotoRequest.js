const { ObjectId } = require("mongodb");

const photoRequestSchema = {
  requesterId: ObjectId,
  targetId: ObjectId,
  status: String,
  timestamp: Date,
};

module.exports = photoRequestSchema;
