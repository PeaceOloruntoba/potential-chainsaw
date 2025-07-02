const paypal = require("../config/paypal");
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

    // Create PayPal order for £14.99 (post-trial)
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: "14.99",
          },
          description: "UniStudents Match Monthly Subscription",
        },
      ],
      payment_source: {
        card: {
          number: cardDetails.cardNumber,
          expiry: cardDetails.expiryDate.replace("/", ""),
          cvv: cardDetails.cvv,
        },
      },
    });

    const response = await paypal.execute(request);
    if (response.statusCode !== 201) {
      throw createError(500, "Failed to create PayPal order");
    }

    // Store PayPal order ID and card details
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.status": "trial", // Remains trial until 30 days
          "subscription.cardDetails": {
            last4: cardDetails.cardNumber.slice(-4),
            processor: "paypal",
            paypalOrderId: response.result.id,
          },
        },
      }
    );

    logger.info(
      `Payment setup for user ${userId} with PayPal order ${response.result.id}`
    );
    return response.result;
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
