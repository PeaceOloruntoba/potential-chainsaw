const paypal = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const logger = require("../utils/logger");
const axios = require("axios");

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
if (!process.env.STRIPE_MONTHLY_PRICE_ID) {
  logger.error("STRIPE_MONTHLY_PRICE_ID is not set in environment variables");
  throw new Error(
    "STRIPE_MONTHLY_PRICE_ID is required for Stripe subscriptions."
  );
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  logger.warn(
    "STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will be skipped."
  );
}
if (!process.env.PAYPAL_API_BASE_URL) {
  logger.warn(
    "PAYPAL_API_BASE_URL is not set. Defaulting to PayPal Sandbox API."
  );
}

const PAYPAL_API_BASE_URL =
  process.env.PAYPAL_API_BASE_URL || "https://api-m.paypal.com";

const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const getPaypalAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");
    const response = await axios.post(
      `${PAYPAL_API_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    logger.error(`Error getting PayPal access token: ${error.message}`);
    throw new Error("Failed to get PayPal access token.");
  }
};

const verifyPaypalWebhookSignature = async ({
  transmissionId,
  transmissionTime,
  webhookId,
  eventBody,
  certUrl,
  authAlgo,
  transmissionSig,
}) => {
  try {
    const accessToken = await getPaypalAccessToken();
    const response = await axios.post(
      `${PAYPAL_API_BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: JSON.parse(eventBody),
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.verification_status === "SUCCESS") {
      logger.info("PayPal webhook signature verified successfully.");
      return true;
    } else {
      logger.warn(
        `PayPal webhook signature verification failed: ${response.data.verification_status}`
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Error verifying PayPal webhook signature: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error("Failed to verify PayPal webhook signature.");
  }
};

const createPaypalSubscription = async (planId, user) => {
  try {
    const accessToken = await getPaypalAccessToken();

    const response = await axios.post(
      `${PAYPAL_API_BASE_URL}/v1/billing/subscriptions`,
      {
        plan_id: planId,
        start_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        subscriber: {
          name: {
            given_name: user.firstName,
            surname: user.lastName,
          },
          email_address: user.email,
        },
        application_context: {
          brand_name: "Unistudents Match",
          locale: "en-US",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${process.env.CLIENT_URL}/subscribe/success`,
          cancel_url: `${process.env.CLIENT_URL}/subscribe`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      }
    );

    logger.info(`PayPal subscription created: ${response.data.id}`);
    return response.data;
  } catch (error) {
    logger.error(
      `PayPal subscription creation error: ${
        error.response?.data?.message || error.message
      }`
    );
    throw new Error(
      `PayPal subscription failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

const cancelPaypalSubscription = async (subscriptionId) => {
  try {
    const accessToken = await getPaypalAccessToken();
    await axios.post(
      `${PAYPAL_API_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    logger.info(`PayPal subscription ${subscriptionId} cancelled.`);
    return { success: true };
  } catch (error) {
    logger.error(`PayPal subscription cancellation error: ${error.message}`);
    throw error;
  }
};

const createStripeCustomerAndPaymentMethod = async (
  userEmail,
  paymentMethodIdFromFrontend
) => {
  try {
    let customer;
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        payment_method: paymentMethodIdFromFrontend,
        invoice_settings: {
          default_payment_method: paymentMethodIdFromFrontend,
        },
      });
    }

    await stripe.paymentMethods.attach(paymentMethodIdFromFrontend, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodIdFromFrontend,
      },
    });

    logger.info(
      `Stripe Customer ${customer.id} processed with PaymentMethod ${paymentMethodIdFromFrontend}`
    );
    return {
      customerId: customer.id,
      paymentMethodId: paymentMethodIdFromFrontend,
    };
  } catch (error) {
    logger.error(`Stripe customer/payment method error: ${error.message}`);
    throw error;
  }
};

const createStripeSubscription = async (customerId, paymentMethodId) => {
  try {
    const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ["latest_invoice.payment_intent"],
    });

    logger.info(
      `Stripe subscription ${subscription.id} created with status: ${subscription.status}`
    );
    return subscription;
  } catch (error) {
    logger.error(`Stripe subscription creation error: ${error.message}`);
    throw error;
  }
};

const cancelStripeSubscription = async (subscriptionId) => {
  try {
    const cancelledSubscription = await stripe.subscriptions.update(
      subscriptionId,
      { cancel_at_period_end: true }
    );
    logger.info(
      `Stripe subscription ${subscriptionId} scheduled for cancellation.`
    );
    return cancelledSubscription;
  } catch (error) {
    logger.error(`Stripe subscription cancellation error: ${error.message}`);
    throw error;
  }
};

const createStripeSubscriptionWithTrial = async (
  customerId,
  paymentMethodId,
  trialDays
) => {
  try {
    const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: trialDays,
      expand: ["latest_invoice.payment_intent"],
    });

    logger.info(
      `Stripe subscription ${subscription.id} created with trial of ${trialDays} days.`
    );
    return subscription;
  } catch (error) {
    logger.error(`Stripe subscription creation error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  paypalClient,
  getPaypalAccessToken,
  verifyPaypalWebhookSignature,
  createPaypalSubscription,
  cancelPaypalSubscription,
  createStripeCustomerAndPaymentMethod,
  createStripeSubscription,
  cancelStripeSubscription,
  stripe,
  createStripeSubscriptionWithTrial,
};
