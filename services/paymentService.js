// services/paymentService.js
const paypal = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const logger = require("../utils/logger");

if (!process.env.STRIPE_SECRET_KEY) {
  logger.error("STRIPE_SECRET_KEY is not set in environment variables");
  throw new Error("STRIPE_SECRET_KEY is required for payment service.");
}
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  logger.error(
    "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set in environment variables"
  );
  throw new Error("PayPal credentials are required for payment service.");
}

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
            value: amount.toString(),
          },
          description,
        },
      ],
    });

    const response = await paypalClient.execute(request);
    logger.info(`PayPal payment authorized: ${response.result.id}`);
    return { status: response.result.status, id: response.result.id };
  } catch (error) {
    logger.error(`PayPal payment authorization error: ${error.message}`);
    throw error;
  }
};

const authorizeStripePayment = async (userId, cardDetails) => {
  try {
    if (
      !cardDetails ||
      !cardDetails.cardNumber ||
      !cardDetails.expiryDate ||
      !cardDetails.cvv
    ) {
      throw new Error("Missing card details for Stripe payment.");
    }

    const [exp_month_str, exp_year_str] = cardDetails.expiryDate.split("/");
    const exp_month = parseInt(exp_month_str);
    const exp_year = parseInt(exp_year_str);

    if (isNaN(exp_month) || isNaN(exp_year)) {
      throw new Error("Invalid expiry date format.");
    }

    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardDetails.cardNumber,
        exp_month: exp_month,
        exp_year: exp_year,
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
      return_url: `${process.env.CLIENT_URL}/payment-success`,
    });

    logger.info(
      `Stripe payment authorized: ${paymentIntent.id}, status: ${paymentIntent.status}`
    );
    return {
      status:
        paymentIntent.status === "succeeded" ? "CREATED" : paymentIntent.status,
      id: paymentIntent.id,
    };
  } catch (error) {
    logger.error(`Stripe payment authorization error: ${error.message}`);
    throw error;
  }
};

module.exports = { authorizePaypalPayment, authorizeStripePayment };
