const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true, enum: ["male", "female"] },
  university: { type: String, required: true },
  status: { type: String, required: true, enum: ["student", "graduate"] },
  description: { type: String, required: true },
  lookingFor: { type: String, required: true },
  guardianEmail: { type: String },
  guardianPhone: { type: String },
  isAdmin: { type: Boolean, default: false },
  hasActiveSubscription: { type: Boolean, default: false }, // New field
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
