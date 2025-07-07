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
      application_context: {
        return_url: `${process.env.CLIENT_URL}/payment-success`,
        cancel_url: `${process.env.CLIENT_URL}/subscribe`,
      },
    });

    const response = await paypalClient.execute(request);
    logger.info(`PayPal order created: ${response.result.id}`);
    return { status: response.result.status, id: response.result.id };
  } catch (error) {
    logger.error(`PayPal order creation error: ${error.message}`);
    throw error;
  }
};

// Modified: Now expects a tokenized paymentMethodId from the frontend
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
      // Attach new payment method if it's not already attached
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
        // If already attached, ensure it's the default
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodIdFromFrontend,
          },
        });
      }
    } else {
      // Create new customer and attach payment method
      customer = await stripe.customers.create({
        email: userEmail,
        payment_method: paymentMethodIdFromFrontend, // Attach payment method to customer
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
    if (!priceId) {
      throw new Error(
        "STRIPE_MONTHLY_PRICE_ID is not set in environment variables."
      );
    }

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
    const cancelledSubscription = await stripe.subscriptions.cancel(
      subscriptionId
    );
    logger.info(`Stripe subscription ${subscriptionId} cancelled.`);
    return cancelledSubscription;
  } catch (error) {
    logger.error(`Stripe subscription cancellation error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  paypalClient,
  authorizePaypalPayment,
  createStripeCustomerAndPaymentMethod,
  createStripeSubscription,
  cancelStripeSubscription,
};
