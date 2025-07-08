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
    logger.error(
      `Stripe Webhook Error: Invalid signature or payload: ${err.message}`
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Stripe Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "invoice.payment_succeeded":
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        logger.info(
          `Invoice payment succeeded for customer ${customerId}, subscription ${subscriptionId}`
        );

        // Find user by Stripe customer ID and update subscription status
        const userByStripeCustomer =
          await userService.findUserByStripeCustomerId(customerId);
        if (userByStripeCustomer) {
          await userService.updateUser(userByStripeCustomer._id, {
            hasActiveSubscription: true,
            subscription: {
              ...userByStripeCustomer.subscription,
              status: "active",
              lastPaymentDate: new Date(
                invoice.status_transitions.paid_at * 1000
              ), // Use invoice paid_at
              nextBillingDate: new Date(
                invoice.lines.data[0].period.end * 1000
              ), // Use subscription period end
            },
          });
          logger.info(
            `User ${userByStripeCustomer._id} subscription updated to active via webhook.`
          );
        } else {
          logger.warn(`User not found for Stripe customer ID: ${customerId}`);
        }
        break;

      case "invoice.payment_failed":
        const failedInvoice = event.data.object;
        const failedCustomerId = failedInvoice.customer;
        logger.warn(`Invoice payment failed for customer ${failedCustomerId}`);

        const userByFailedStripeCustomer =
          await userService.findUserByStripeCustomerId(failedCustomerId);
        if (userByFailedStripeCustomer) {
          await userService.updateUser(userByFailedStripeCustomer._id, {
            hasActiveSubscription: false, // Mark as inactive on payment failure
            subscription: {
              ...userByFailedStripeCustomer.subscription,
              status: "past_due", // Or 'unpaid'
              // You might want to set a grace period or trigger dunning emails here
            },
          });
          logger.info(
            `User ${userByFailedStripeCustomer._id} subscription marked as past_due via webhook.`
          );
        }
        break;

      case "customer.subscription.deleted":
        const subscription = event.data.object;
        const deletedCustomerId = subscription.customer;
        logger.info(
          `Subscription ${subscription.id} deleted for customer ${deletedCustomerId}`
        );

        const userByDeletedStripeCustomer =
          await userService.findUserByStripeCustomerId(deletedCustomerId);
        if (userByDeletedStripeCustomer) {
          await userService.updateUser(userByDeletedStripeCustomer._id, {
            hasActiveSubscription: false,
            subscription: {
              ...userByDeletedStripeCustomer.subscription,
              status: "inactive",
              nextBillingDate: null,
              stripeSubscriptionId: null, // Clear subscription ID
            },
          });
          logger.info(
            `User ${userByDeletedStripeCustomer._id} subscription marked as inactive via webhook.`
          );
        }
        break;

      case "customer.subscription.updated":
        const updatedSubscription = event.data.object;
        const updatedCustomerId = updatedSubscription.customer;
        logger.info(
          `Subscription ${updatedSubscription.id} updated for customer ${updatedCustomerId}. Status: ${updatedSubscription.status}`
        );

        const userByUpdatedStripeCustomer =
          await userService.findUserByStripeCustomerId(updatedCustomerId);
        if (userByUpdatedStripeCustomer) {
          await userService.updateUser(userByUpdatedStripeCustomer._id, {
            hasActiveSubscription:
              updatedSubscription.status === "active" ||
              updatedSubscription.status === "trialing",
            subscription: {
              ...userByUpdatedStripeCustomer.subscription,
              status: updatedSubscription.status,
              // Update nextBillingDate based on updatedSubscription.current_period_end
              nextBillingDate: updatedSubscription.current_period_end
                ? new Date(updatedSubscription.current_period_end * 1000)
                : null,
              lastPaymentDate:
                updatedSubscription.latest_invoice?.status === "paid"
                  ? new Date(
                      updatedSubscription.latest_invoice.status_transitions
                        .paid_at * 1000
                    )
                  : userByUpdatedStripeCustomer.subscription?.lastPaymentDate,
            },
          });
          logger.info(
            `User ${userByUpdatedStripeCustomer._id} subscription status updated to ${updatedSubscription.status} via webhook.`
          );
        }
        break;

      default:
        logger.warn(`Unhandled Stripe event type ${event.type}`);
    }
  } catch (error) {
    logger.error(
      `Error handling Stripe webhook event ${event.type}: ${error.message}`
    );
    return res.status(500).send(`Webhook handler error: ${error.message}`);
  }

  res.json({ received: true });
};

module.exports = { handleStripeWebhook };
