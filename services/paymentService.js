const paypal = require("@paypal/checkout-server-sdk");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

// PayPal client setup
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

const authorizePayment = async (amount, currency, description) => {
  try {
    logger.info(
      `Attempting to authorize PayPal payment for ${amount} ${currency}`
    );
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: "AUTHORIZE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description: description,
        },
      ],
    });

    const response = await client.execute(request);

    if (response.statusCode !== 201) {
      logger.error(
        `PayPal authorization order creation failed: ${JSON.stringify(
          response.result
        )}`
      );
      throw createError(500, "Failed to create PayPal authorization order");
    }

    logger.info(`PayPal authorization order created: ${response.result.id}`);
    return response.result; // Returns the order details, including the order ID
  } catch (error) {
    logger.error(`PayPal authorization error: ${error.message}`);
    throw createError(
      error.statusCode || 500,
      "PayPal authorization failed",
      error.message
    );
  }
};

const capturePayment = async (userId, paypalOrderId) => {
  try {
    if (!userId) {
      throw createError(400, "User ID is required to capture payment.");
    }
    if (!paypalOrderId) {
      throw createError(400, "PayPal Order ID is required to capture payment.");
    }

    const db = getDB();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    if (!user) throw createError(404, "User not found");

    logger.info(
      `Attempting to capture PayPal order ${paypalOrderId} for user ${userId}`
    );

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const response = await client.execute(request);

    if (response.statusCode !== 201) {
      logger.error(
        `PayPal capture failed for order ${paypalOrderId}: ${JSON.stringify(
          response.result
        )}`
      );
      throw createError(500, "Failed to capture PayPal payment");
    }

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.status": "active",
          "subscription.lastPaymentDate": new Date(),
          "subscription.nextBillingDate": new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ),
          "subscription.paypalOrderId": paypalOrderId,
        },
      }
    );

    logger.info(
      `PayPal order ${paypalOrderId} captured successfully for user ${userId}`
    );
    return response.result;
  } catch (error) {
    logger.error(`Payment capture error: ${error.message}`);
    throw createError(
      error.statusCode || 500,
      "Payment capture failed",
      error.message
    );
  }
};

const cancelSubscription = async (userId) => {
  try {
    if (!userId) {
      throw createError(400, "User ID is required to cancel subscription.");
    }
    const db = getDB();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.status": "cancelled",
          "subscription.paypalOrderId": null,
          "subscription.nextBillingDate": null,
        },
      }
    );
    logger.info(`Subscription cancelled for user ${userId}`);
  } catch (error) {
    logger.error(`Subscription cancellation error: ${error.message}`);
    throw createError(
      error.statusCode || 500,
      "Subscription cancellation failed",
      error.message
    );
  }
};

module.exports = { authorizePayment, capturePayment, cancelSubscription };
