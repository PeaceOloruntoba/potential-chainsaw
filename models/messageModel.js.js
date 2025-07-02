const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
