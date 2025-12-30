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
        const user = await userService.findUserByStripeCustomerId(customerId);

        if (user) {
          const periodEnd =
            invoice.lines.data[0]?.period?.end || invoice.period_end;
          const paidAt = invoice.status_transitions?.paid_at;

          await userService.updateUser(user._id, {
            hasActiveSubscription: true,
            subscription: {
              ...user.subscription,
              status: "active",
              lastPaymentDate: paidAt ? new Date(paidAt * 1000) : new Date(),
              nextBillingDate: periodEnd ? new Date(periodEnd * 1000) : null,
            },
          });
          logger.info(`User ${user._id} subscription updated to active`);
          // Send renewal success email
          try {
            const notificationService = require("../services/notificationService");
            await notificationService.notifyUser(
              user.email,
              user.firstName,
              "subscription_renewed",
              null,
              { type: "Stripe" }
            );
          } catch (e) {
            logger.warn(`Failed to send Stripe renewal email for user ${user._id}: ${e.message}`);
          }
        } else {
          logger.warn(`No user found for Stripe customer ID: ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
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
        const user = await userService.findUserByStripeCustomerId(customerId);

        if (user) {
          const status =
            subscription.status === "trialing" ? "trial" : subscription.status;
          const nextBillingDate = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null;

          await userService.updateUser(user._id, {
            hasActiveSubscription: ["active", "trialing"].includes(
              subscription.status
            ),
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

const handlePaypalWebhook = async (req, res, next) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const transmissionId = req.headers["paypal-transmission-id"];
    const transmissionTime = req.headers["paypal-transmission-time"];
    const certUrl = req.headers["paypal-cert-url"];
    const authAlgo = req.headers["paypal-auth-algo"];
    const transmissionSig = req.headers["paypal-transmission-sig"];
    const webhookEventBody = JSON.stringify(req.body);

    const isValid = await paymentService.verifyPaypalWebhookSignature({
      transmissionId,
      transmissionTime,
      webhookId,
      eventBody: webhookEventBody,
      certUrl,
      authAlgo,
      transmissionSig,
    });

    if (!isValid) {
      logger.error("Invalid PayPal webhook signature");
      return res.status(400).send("Invalid webhook signature");
    }

    const event = req.body;
    logger.info(`PayPal Webhook received: ${event.event_type}`);

    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscriptionId = event.resource.id;
        const user = await userService.findUserByPaypalSubscriptionId(
          subscriptionId
        );

        if (user) {
          await userService.updateUser(user._id, {
            hasActiveSubscription: true,
            subscription: {
              ...user.subscription,
              status: "active",
              lastPaymentDate: new Date(event.resource.start_time),
              nextBillingDate: new Date(
                event.resource.billing_info.next_billing_time
              ),
            },
          });
          logger.info(`User ${user._id} subscription activated`);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED": {
        const subscriptionId = event.resource.id;
        const user = await userService.findUserByPaypalSubscriptionId(
          subscriptionId
        );

        if (user) {
          await userService.updateUser(user._id, {
            hasActiveSubscription: false,
            subscription: {
              ...user.subscription,
              status: "inactive",
              nextBillingDate: null,
              paypalSubscriptionId: null,
            },
          });
          logger.info(`User ${user._id} subscription cancelled`);
        }
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        const billingAgreementId = event.resource.billing_agreement_id;
        const user = await userService.findUserByPaypalSubscriptionId(
          billingAgreementId
        );

        if (user) {
          // Fetch subscription details to get accurate next_billing_time
          try {
            const accessToken = await paymentService.getPaypalAccessToken();
            const axios = require("axios");
            const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.paypal.com";
            const resp = await axios.get(
              `${baseUrl}/v1/billing/subscriptions/${billingAgreementId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const nextBilling = resp.data?.billing_info?.next_billing_time
              ? new Date(resp.data.billing_info.next_billing_time)
              : user.subscription.nextBillingDate;

            await userService.updateUser(user._id, {
              hasActiveSubscription: true,
              subscription: {
                ...user.subscription,
                status: "active",
                lastPaymentDate: new Date(event.resource.create_time),
                nextBillingDate: nextBilling,
              },
            });
          } catch (e) {
            // Fallback: update lastPaymentDate only
            await userService.updateUser(user._id, {
              subscription: {
                ...user.subscription,
                lastPaymentDate: new Date(event.resource.create_time),
              },
            });
            logger.warn(`Failed to refresh PayPal next billing date for user ${user._id}: ${e.message}`);
          }
          // Send renewal success email
          try {
            const notificationService = require("../services/notificationService");
            await notificationService.notifyUser(
              user.email,
              user.firstName,
              "subscription_renewed",
              null,
              { type: "PayPal" }
            );
          } catch (e) {
            logger.warn(`Failed to send PayPal renewal email for user ${user._id}: ${e.message}`);
          }
          logger.info(`Payment completed for user ${user._id}`);
        }
        break;
      }

      default:
        logger.warn(`Unhandled PayPal event type: ${event.event_type}`);
    }
  } catch (err) {
    logger.error(`Error processing PayPal webhook: ${err.message}`);
    return res.status(500).send(`Webhook handler error: ${err.message}`);
  }

  res.json({ received: true });
};

module.exports = { handleStripeWebhook, handlePaypalWebhook };
