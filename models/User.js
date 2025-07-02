const { ObjectId } = require("mongodb");

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
    status: String,
    startDate: Date,
    cardDetails: {
      last4: String,
      processor: String,
      paypalOrderId: String,
    },
  },
  profilePhoto: String,
  isAdmin: Boolean,
};

module.exports = userSchema;
