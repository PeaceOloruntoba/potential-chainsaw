const paypal = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const { createLogger, transports, format } = require("winston");

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
  ],
});

// Validate environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  logger.error("STRIPE_SECRET_KEY is not set in environment variables");
  throw new Error("STRIPE_SECRET_KEY is required");
}
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  logger.error(
    "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set in environment variables"
  );
  throw new Error("PayPal credentials are required");
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
      amount: 1499, // £14.99 in pence
      currency: "gbp",
      payment_method: paymentMethod.id,
      description: "Unistudents Match Subscription",
      metadata: { userId },
      confirm: true,
    });

    logger.info(`Stripe payment authorized: ${paymentIntent.id}`);
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
