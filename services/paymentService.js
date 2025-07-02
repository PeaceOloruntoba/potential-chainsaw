// services/paymentService.js
const paypal = require("../config/paypal");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

/**
 * Authorizes a payment with PayPal for a free trial.
 * This function is called by the frontend's PayPal Card Fields' createOrder callback.
 * It creates an order with 'AUTHORIZE' intent, which validates the card
 * without immediately capturing funds.
 *
 * @param {string} amount - The amount to authorize (e.g., "14.99").
 * @param {string} currency - The currency code (e.g., "GBP").
 * @param {string} description - Description for the PayPal order.
 * @returns {Promise<object>} PayPal order details including the order ID.
 */
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

    const response = await paypal.execute(request);

    if (response.statusCode !== 201) {
      logger.error(
        `PayPal authorization order creation failed: ${JSON.result.error}`
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

/**
 * Captures an already authorized PayPal payment.
 * This function is called when the trial ends or subscription is activated.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} paypalOrderId - The PayPal Order ID obtained from the authorization step.
 * @returns {Promise<object>} PayPal capture details.
 */
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
    request.requestBody({}); // Empty body for capture

    const response = await paypal.execute(request);

    if (response.statusCode !== 201) {
      logger.error(
        `PayPal capture failed for order ${paypalOrderId}: ${JSON.stringify(
          response.result
        )}`
      );
      throw createError(500, "Failed to capture PayPal payment");
    }

    // Update user's subscription status to active and store payment details
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.status": "active",
          "subscription.lastPaymentDate": new Date(),
          "subscription.nextBillingDate": new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ),
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
          "subscription.cardDetails.paypalOrderId": null,
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
