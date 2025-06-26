const stripe = require("../config/stripe");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

const processPayment = async (userId, cardDetails) => {
  try {
    const db = getDB();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    if (!user) throw createError(404, "User not found");

    // Create Stripe customer if not exists
    let customer = user.stripeCustomerId;
    if (!customer) {
      customer = await stripe.customers.create({
        email: user.email,
        source: cardDetails.token, // Token from Stripe.js on frontend
      });
      await db
        .collection("users")
        .updateOne(
          { _id: new ObjectId(userId) },
          { $set: { stripeCustomerId: customer.id } }
        );
    }

    // Charge £14.99
    const charge = await stripe.charges.create({
      amount: 1499, // £14.99 in pence
      currency: "gbp",
      customer: customer.id,
      description: "UniStudents Match Monthly Subscription",
    });

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.status": "active",
          "subscription.cardDetails": {
            last4: cardDetails.last4,
            processor: "stripe",
          },
        },
      }
    );

    logger.info(`Payment processed for user ${userId}`);
    return charge;
  } catch (error) {
    logger.error(`Payment processing error: ${error.message}`);
    throw createError(500, "Payment processing failed", error.message);
  }
};

const cancelSubscription = async (userId) => {
  try {
    const db = getDB();
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            "subscription.status": "cancelled",
            "subscription.cardDetails": null,
          },
        }
      );
    logger.info(`Subscription cancelled for user ${userId}`);
  } catch (error) {
    logger.error(`Subscription cancellation error: ${error.message}`);
    throw createError(500, "Subscription cancellation failed", error.message);
  }
};

module.exports = { processPayment, cancelSubscription };
