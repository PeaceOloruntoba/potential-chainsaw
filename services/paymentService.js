const paypal = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const logger = require("../utils/logger");

const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const authorizePaypalPayment = async (amount, currency, description) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description,
        },
      ],
    });

    const response = await paypalClient.execute(request);
    return { status: response.result.status, id: response.result.id };
  } catch (error) {
    logger.error(`PayPal payment authorization error: ${error.message}`);
    throw error;
  }
};

const authorizeStripePayment = async (userId, cardDetails) => {
  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardDetails.cardNumber,
        exp_month: parseInt(cardDetails.expiryDate.split("/")[0]),
        exp_year: parseInt(cardDetails.expiryDate.split("/")[1]),
        cvc: cardDetails.cvv,
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1499,
      currency: "gbp",
      payment_method: paymentMethod.id,
      description: "Unistudents Match Subscription",
      metadata: { userId },
      confirm: true,
    });

    return {
      status:
        paymentIntent.status === "succeeded" ? "CREATED" : paymentIntent.status,
      id: paymentMethod.id,
    };
  } catch (error) {
    logger.error(`Stripe payment authorization error: ${error.message}`);
    throw error;
  }
};

module.exports = { authorizePaypalPayment, authorizeStripePayment };
