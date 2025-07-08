const Stripe = require("stripe");
const logger = require("../utils/logger");
const userService = require("../services/userService");
const { createError } = require("../utils/errorHandler");
const paymentService = require("../services/paymentService");

const handleStripeWebhook = async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = paymentService.stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      endpointSecret
    );
  } catch (err) {
    logger.error(`Stripe Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Stripe Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        logger.info(
          `Payment succeeded for customer ${customerId}, subscription ${subscriptionId}`
        );

        const user = await userService.findUserByStripeCustomerId(customerId);
        if (user) {
          const periodEnd =
            invoice.lines.data[0]?.period?.end || invoice.period_end;
          const paidAt = invoice.status_transitions?.paid_at;

          // Determine status: was it trialing before?
          const newStatus =
            user.subscription?.status === "trial" ? "active" : "active";

          await userService.updateUser(user._id, {
            hasActiveSubscription: true,
            subscription: {
              ...user.subscription,
              status: newStatus,
              lastPaymentDate: paidAt ? new Date(paidAt * 1000) : new Date(),
              nextBillingDate: periodEnd ? new Date(periodEnd * 1000) : null,
            },
          });
          logger.info(`User ${user._id} subscription updated to ${newStatus}`);
        } else {
          logger.warn(`User not found for Stripe customer ID: ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        logger.warn(`Payment failed for customer ${customerId}`);

        const user = await userService.findUserByStripeCustomerId(customerId);
        if (user) {
          await userService.updateUser(user._id, {
            hasActiveSubscription: false,
            subscription: {
              ...user.subscription,
              status: "past_due",
            },
          });
          logger.info(`User ${user._id} subscription marked as past_due`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        logger.info(`Subscription deleted for customer ${customerId}`);

        const user = await userService.findUserByStripeCustomerId(customerId);
        if (user) {
          await userService.updateUser(user._id, {
            hasActiveSubscription: false,
            subscription: {
              ...user.subscription,
              status: "inactive",
              nextBillingDate: null,
              stripeSubscriptionId: null,
            },
          });
          logger.info(`User ${user._id} subscription marked as inactive`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        logger.info(
          `Subscription updated for customer ${customerId}. Status: ${subscription.status}`
        );

        const user = await userService.findUserByStripeCustomerId(customerId);
        if (user) {
          const nextBillingDate = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null;

          const status =
            subscription.status === "trialing"
              ? "trial"
              : subscription.status === "active"
              ? "active"
              : subscription.status;

          await userService.updateUser(user._id, {
            hasActiveSubscription:
              subscription.status === "active" ||
              subscription.status === "trialing",
            subscription: {
              ...user.subscription,
              status,
              nextBillingDate,
            },
          });
          logger.info(`User ${user._id} subscription updated to ${status}`);
        }
        break;
      }

      default:
        logger.warn(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err) {
    logger.error(
      `Error processing Stripe webhook ${event.type}: ${err.message}`
    );
    return res.status(500).send(`Webhook handler error: ${err.message}`);
  }

  res.json({ received: true });
};

module.exports = { handleStripeWebhook };
