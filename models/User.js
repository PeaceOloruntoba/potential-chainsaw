const { ObjectId } = require("mongodb"); // Import ObjectId if you use it for validation/types

const userSchema = {
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  age: Number,
  gender: String,
  university: String,
  status: String,
  description: String,
  lookingFor: String,
  guardian: {
    email: String,
    phone: String,
  },
  subscription: {
    status: {
      type: String,
      enum: ["trial", "active", "cancelled", "payment_failed"],
      default: "trial",
    },
    startDate: Date,
    trialEndsAt: Date,
    lastPaymentDate: Date,
    nextBillingDate: Date,
    cardDetails: {
      last4: String,
      processor: String,
      paypalOrderId: String,
    },
  },
  profilePhoto: String,
  isAdmin: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

module.exports = userSchema;
