const paypal = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const logger = require("../utils/logger");
const axios = require("axios"); // Required for direct PayPal API calls

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
    "PAYPAL_API_BASE_URL is not set. Assuming PayPal Sandbox for direct API calls."
  );
}

const PAYPAL_API_BASE_URL =
  process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

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

const createPaypalSubscription = async (planId, user) => {
  try {
    const accessToken = await getPaypalAccessToken();

    const response = await axios.post(
      `${PAYPAL_API_BASE_URL}/v1/billing/subscriptions`,
      {
        plan_id: planId,
        start_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // start in 5 mins
        subscriber: {
          name: {
            given_name: user.firstName,
            surname: user.lastName,
          },
          email_address: user.email,
          shipping_address: user.university
            ? {
                name: {
                  full_name: `${user.firstName} ${user.lastName}`,
                },
                address: {
                  address_line_1: user.address.line1 || "N/A",
                  address_line_2: user.address.line2 || "",
                  admin_area_2: user.address.city || "N/A",
                  admin_area_1: user.address.state || "N/A",
                  postal_code: user.address.postalCode || "00000",
                  country_code: user.address.country || "US",
                },
              }
            : undefined,
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
    return response.data; // Contains approval link
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
      const existingPaymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
      });
      const isAttached = existingPaymentMethods.data.some(
        (pm) => pm.id === paymentMethodIdFromFrontend
      );

      if (!isAttached) {
        await stripe.paymentMethods.attach(paymentMethodIdFromFrontend, {
          customer: customer.id,
        });
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodIdFromFrontend,
          },
        });
      } else {
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodIdFromFrontend,
          },
        });
      }
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        payment_method: paymentMethodIdFromFrontend,
        invoice_settings: {
          default_payment_method: paymentMethodIdFromFrontend,
        },
      });
    }

    logger.info(
      `Stripe Customer ${customer.id} processed with PaymentMethod ${paymentMethodIdFromFrontend}`
    );
    return {
      customerId: customer.id,
      paymentMethodId: paymentMethodIdFromFrontend,
    };
  } catch (error) {
    logger.error(
      `Stripe customer/payment method creation/attachment error: ${error.message}`
    );
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
      `Stripe subscription ${subscriptionId} scheduled for cancellation at period end.`
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
  createPaypalSubscription,
  cancelPaypalSubscription,
  createStripeCustomerAndPaymentMethod,
  createStripeSubscription,
  cancelStripeSubscription,
  stripe,
  createStripeSubscriptionWithTrial,
};
