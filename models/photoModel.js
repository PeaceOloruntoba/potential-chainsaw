const mongoose = require("mongoose");
const { Schema } = mongoose;

const photoSchema = new Schema({
  userId: { type: String, required: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Photo || mongoose.model("Photo", photoSchema);
