const { ObjectId } = require("mongodb");

const userSchema = {
  email: String,
  password: String,
  name: String,
  age: Number,
  gender: String, // 'male' or 'female'
  university: String,
  status: String, // 'student' or 'graduate'
  description: String,
  lookingFor: String,
  guardian: {
    email: String,
    phone: String,
  },
  subscription: {
    status: String, // 'trial', 'active', 'cancelled'
    startDate: Date,
    cardDetails: {
      last4: String,
      processor: String,
    },
  },
  profilePhoto: String,
  isAdmin: Boolean,
};

module.exports = userSchema;
