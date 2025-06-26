const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { cancelSubscription } = require("../services/paymentService");

const getProfiles = async (req, res, next) => {
  try {
    const db = getDB();
    const profiles = await db
      .collection("users")
      .find(
        { _id: { $ne: new ObjectId(req.user.id) } },
        { projection: { password: 0, subscription: 0, guardian: 0 } }
      )
      .toArray();
    res.json(profiles);
  } catch (error) {
    next(error);
  }
};

const cancelSubscriptionHandler = async (req, res, next) => {
  try {
    await cancelSubscription(req.user.id);
    res.json({ message: "Subscription cancelled" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfiles, cancelSubscriptionHandler };
