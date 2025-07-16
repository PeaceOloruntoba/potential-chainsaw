// services/notificationService.js
const emailService = require('./emailService');
const userService = require('./userService'); // Assuming this path is correct
const logger = require('../utils/logger');
// Removed createError import as email failures are now logged, not re-thrown to main flow

/**
 * Notifies the guardian about various events.
 * @param {string} guardianEmail - The guardian's email.
 * @param {string} childFirstName - The first name of the child.
 * @param {string} eventType - The type of event ('registration', 'message', 'subscription_success', 'subscription_failure').
 * @param {string} [senderUserId] - The user ID of the person sending the message (for message notifications).
 * @param {object} [subscriptionDetails] - Details for subscription notifications ({ type, reason }).
 */
const notifyGuardian = async (guardianEmail, childFirstName, eventType, senderUserId = null, subscriptionDetails = {}) => {
    try {
        // You might need to fetch the guardian's first name if you want to use it in the email.
        // For simplicity, this example assumes you have it or can derive it, or uses 'Guardian' as fallback.
        const guardianUser = await userService.findUserByEmail(guardianEmail);
        const guardianFirstName = guardianUser ? guardianUser.firstName : 'Guardian';

        let senderFirstName = '';
        if (senderUserId) {
            const senderUser = await userService.findUserById(senderUserId);
            senderFirstName = senderUser ? senderUser.firstName : 'Someone';
        }

        switch (eventType) {
            case 'registration':
                await emailService.sendGuardianWelcomeEmail(guardianEmail, guardianFirstName, childFirstName);
                break;
            case 'message':
                await emailService.sendGuardianMessageNotification(guardianEmail, guardianFirstName, childFirstName, senderFirstName);
                break;
            case 'subscription_success':
                await emailService.sendGuardianSubscriptionSuccessEmail(guardianEmail, guardianFirstName, childFirstName, subscriptionDetails.type);
                break;
            case 'subscription_failure':
                await emailService.sendGuardianSubscriptionFailedEmail(guardianEmail, guardianFirstName, childFirstName, subscriptionDetails.reason);
                break;
            default:
                logger.warn(`Unhandled guardian notification event type: ${eventType}`);
                break;
        }
        logger.info(`Guardian ${guardianEmail} notified for event: ${eventType} concerning ${childFirstName}.`);
    } catch (error) {
        logger.error(`Error notifying guardian ${guardianEmail} for event ${eventType}: ${error.message}`);
        // Do not rethrow, as email failure shouldn't block main flow usually
    }
};

/**
 * Notifies a user about various events.
 * @param {string} userEmail - The user's email.
 * @param {string} firstName - The user's first name.
 * @param {string} eventType - The type of event ('welcome', 'subscription_success', 'subscription_failure', 'new_message').
 * @param {string} [senderUserId] - The user ID of the person sending the message (for message notifications).
 * @param {object} [subscriptionDetails] - Details for subscription notifications ({ type, reason }).
 */
const notifyUser = async (userEmail, firstName, eventType, senderUserId = null, subscriptionDetails = {}) => {
    try {
        let senderFirstName = '';
        if (senderUserId) {
            const senderUser = await userService.findUserById(senderUserId);
            senderFirstName = senderUser ? senderUser.firstName : 'Someone';
        }

        switch (eventType) {
            case 'welcome':
                await emailService.sendWelcomeEmail(userEmail, firstName);
                break;
            case 'subscription_success':
                await emailService.sendSubscriptionSuccessEmail(userEmail, firstName, subscriptionDetails.type);
                break;
            case 'subscription_failure':
                await emailService.sendSubscriptionFailedEmail(userEmail, firstName, subscriptionDetails.reason);
                break;
            case 'new_message':
                await emailService.sendNewMessageNotification(userEmail, firstName, senderFirstName);
                break;
            default:
                logger.warn(`Unhandled user notification event type: ${eventType}`);
                break;
        }
        logger.info(`User ${userEmail} notified for event: ${eventType}.`);
    } catch (error) {
        logger.error(`Error notifying user ${userEmail} for event ${eventType}: ${error.message}`);
        // Do not rethrow, as email failure shouldn't block main flow usually
    }
};


module.exports = {
    notifyGuardian,
    notifyUser,
};
