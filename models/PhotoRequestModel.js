const mongoose = require("mongoose");
const { Schema } = mongoose;

const photoRequestSchema = new Schema({
  requesterId: { type: String, required: true },
  targetUserId: { type: String, required: true },
  status: {
    type: String,
    required: true,
    enum: ["pending", "accepted", "rejected"],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports =
  mongoose.models.PhotoRequest ||
  mongoose.model("PhotoRequest", photoRequestSchema);
