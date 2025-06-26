const { ObjectId } = require("mongodb");

const photoRequestSchema = {
  requesterId: ObjectId,
  targetId: ObjectId,
  status: String, // 'pending', 'accepted', 'rejected'
  timestamp: Date,
};

module.exports = photoRequestSchema;
