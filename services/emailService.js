// services/emailService.js
const SibApiV3Sdk = require('sib-api-v3-sdk');
const logger = require('../utils/logger'); // Assuming you have a logger utility
const { createError } = require('../utils/errorHandler'); // Assuming you have an error handler utility

// Configure Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@yourdomain.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Your App Name';
const APP_NAME = process.env.APP_NAME || 'Your Application'; // General app name for templates

// Brevo Template IDs - REPLACE THESE WITH YOUR ACTUAL TEMPLATE IDs FROM BREVO
const TEMPLATE_IDS = {
    WELCOME_MAIL: parseInt(process.env.BREVO_TEMPLATE_ID_WELCOME),
    SUBSCRIPTION_SUCCESS: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_SUCCESS),
    SUBSCRIPTION_FAILED: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_FAILED),
    NEW_MESSAGE: parseInt(process.env.BREVO_TEMPLATE_ID_NEW_MESSAGE),
    GUARDIAN_WELCOME_MAIL: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_WELCOME),
    GUARDIAN_MESSAGE_NOTIFICATION: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_MESSAGE),
    GUARDIAN_SUBSCRIPTION_SUCCESS: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_SUCCESS),
    GUARDIAN_SUBSCRIPTION_FAILED: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_FAILED),
    SUBSCRIPTION_7DAY_WARNING: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_7DAY_WARNING),
    SUBSCRIPTION_3DAY_WARNING: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_3DAY_WARNING),
    SUBSCRIPTION_EXPIRY_TODAY: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_EXPIRY_TODAY),
    SUBSCRIPTION_RENEWED: parseInt(process.env.BREVO_TEMPLATE_ID_SUBSCRIPTION_RENEWED),
    GUARDIAN_SUBSCRIPTION_7DAY_WARNING: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_7DAY_WARNING),
    GUARDIAN_SUBSCRIPTION_3DAY_WARNING: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_3DAY_WARNING),
    GUARDIAN_SUBSCRIPTION_EXPIRY_TODAY: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_EXPIRY_TODAY),
    GUARDIAN_SUBSCRIPTION_RENEWED: parseInt(process.env.BREVO_TEMPLATE_ID_GUARDIAN_SUBSCRIPTION_RENEWED),
};

/**
 * Sends an email using a Brevo transactional template.
 * This function is the core utility for sending all emails.
 * It expects the template to be pre-configured in Brevo with placeholders like {{params.variableName}}.
 *
 * @param {string} toEmail - The recipient's email address.
 * @param {number} templateId - The ID of the Brevo transactional template.
 * @param {object} params - An object containing variables to pass to the template.
 * @param {string} [toName=''] - The recipient's name (optional), used for email client display.
 * @param {string} [subject=''] - Optional: Overrides the subject defined in the Brevo template.
 * @param {string} [senderEmail=SENDER_EMAIL] - The sender's email address.
 * @param {string} [senderName=SENDER_NAME] - The sender's name.
 */
const sendBrevoTemplateEmail = async (toEmail, templateId, params = {}, toName = '', subject = '', senderEmail = SENDER_EMAIL, senderName = SENDER_NAME) => {
    if (!process.env.BREVO_API_KEY) {
        logger.warn('Brevo API key not configured. Skipping email sending.');
        return;
    }

    if (!toEmail || !templateId) {
        logger.error(`sendBrevoTemplateEmail: Missing required parameters. toEmail: ${toEmail}, templateId: ${templateId}`);
        // Do not throw here, let the calling service handle the error gracefully
        return;
    }

    // Add common parameters to all templates
    const mergedParams = {
        appName: APP_NAME,
        currentYear: new Date().getFullYear(),
        ...params
    };

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { email: senderEmail, name: senderName };
    sendSmtpEmail.to = [{ email: toEmail, name: toName }];
    sendSmtpEmail.templateId = templateId;
    sendSmtpEmail.params = mergedParams;
    if (subject) {
        sendSmtpEmail.subject = subject; // Override template subject if provided
    }

    try {
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        logger.info(`Email sent successfully to ${toEmail} using template ID ${templateId}. Message ID: ${data.messageId}`);
        return data;
    } catch (error) {
        logger.error(`Error sending email to ${toEmail} using template ID ${templateId}: ${error.message}`);
        if (error.response && error.response.body) {
            logger.error(`Brevo API Error Details: ${JSON.stringify(error.response.body)}`);
        }
        // Re-throw a custom error to be caught by notificationService
        throw createError(500, `Failed to send email via Brevo: ${error.response ? error.response.body.message : error.message}`);
    }
};

// Specific email sending functions
const sendWelcomeEmail = async (userEmail, firstName) => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.WELCOME_MAIL, { firstName }, firstName, `Welcome to ${APP_NAME}!`);
};

const sendSubscriptionSuccessEmail = async (userEmail, firstName, subscriptionType = 'premium') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_SUCCESS, { firstName, subscriptionType }, firstName, `Your ${APP_NAME} Subscription is Active!`);
};

const sendSubscriptionFailedEmail = async (userEmail, firstName, reason = 'unknown reason') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_FAILED, { firstName, reason }, firstName, `Action Required: Your ${APP_NAME} Subscription Failed`);
};

const sendNewMessageNotification = async (receiverEmail, receiverFirstName, senderFirstName) => {
    await sendBrevoTemplateEmail(receiverEmail, TEMPLATE_IDS.NEW_MESSAGE, { firstName: receiverFirstName, messageSender: senderFirstName }, receiverFirstName, `New Message from ${senderFirstName} on ${APP_NAME}`);
};

const sendGuardianWelcomeEmail = async (guardianEmail, guardianFirstName, childFirstName) => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_WELCOME_MAIL, { guardianFirstName, childFirstName }, guardianFirstName, `Important: Your Child ${childFirstName} Registered on ${APP_NAME}`);
};

const sendGuardianMessageNotification = async (guardianEmail, guardianFirstName, childFirstName, messageSenderFirstName) => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_MESSAGE_NOTIFICATION, { guardianFirstName, childFirstName, messageSender: messageSenderFirstName }, guardianFirstName, `Alert: ${childFirstName} Received a Message on ${APP_NAME}`);
};

const sendGuardianSubscriptionSuccessEmail = async (guardianEmail, guardianFirstName, childFirstName, subscriptionType = 'premium') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_SUCCESS, { guardianFirstName, childFirstName, subscriptionType }, guardianFirstName, `Update: ${childFirstName}'s ${APP_NAME} Subscription is Active`);
};

const sendGuardianSubscriptionFailedEmail = async (guardianEmail, guardianFirstName, childFirstName, reason = 'unknown reason') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_FAILED, { guardianFirstName, childFirstName, reason }, guardianFirstName, `Action Required: ${childFirstName}'s ${APP_NAME} Subscription Failed`);
};

// New: Subscription lifecycle emails
const sendSubscription7DayWarningEmail = async (userEmail, firstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_7DAY_WARNING, { firstName, planName, days: 7 }, firstName, `Reminder: Your ${APP_NAME} subscription renews in 7 days`);
};

const sendSubscription3DayWarningEmail = async (userEmail, firstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_3DAY_WARNING, { firstName, planName, days: 3 }, firstName, `Reminder: Your ${APP_NAME} subscription renews in 3 days`);
};

const sendSubscriptionExpiryTodayEmail = async (userEmail, firstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_EXPIRY_TODAY, { firstName, planName }, firstName, `Today: Your ${APP_NAME} subscription is scheduled to renew`);
};

const sendSubscriptionRenewedEmail = async (userEmail, firstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(userEmail, TEMPLATE_IDS.SUBSCRIPTION_RENEWED, { firstName, planName }, firstName, `Success: Your ${APP_NAME} subscription renewed`);
};

// New: Guardian subscription lifecycle emails
const sendGuardianSubscription7DayWarningEmail = async (guardianEmail, guardianFirstName, childFirstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_7DAY_WARNING, { guardianFirstName, childFirstName, planName, days: 7 }, guardianFirstName, `Reminder: ${childFirstName}'s ${APP_NAME} subscription renews in 7 days`);
};

const sendGuardianSubscription3DayWarningEmail = async (guardianEmail, guardianFirstName, childFirstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_3DAY_WARNING, { guardianFirstName, childFirstName, planName, days: 3 }, guardianFirstName, `Reminder: ${childFirstName}'s ${APP_NAME} subscription renews in 3 days`);
};

const sendGuardianSubscriptionExpiryTodayEmail = async (guardianEmail, guardianFirstName, childFirstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_EXPIRY_TODAY, { guardianFirstName, childFirstName, planName }, guardianFirstName, `Today: ${childFirstName}'s ${APP_NAME} subscription is scheduled to renew`);
};

const sendGuardianSubscriptionRenewedEmail = async (guardianEmail, guardianFirstName, childFirstName, planName = 'premium') => {
    await sendBrevoTemplateEmail(guardianEmail, TEMPLATE_IDS.GUARDIAN_SUBSCRIPTION_RENEWED, { guardianFirstName, childFirstName, planName }, guardianFirstName, `${childFirstName}'s ${APP_NAME} subscription renewed successfully`);
};

module.exports = {
    sendWelcomeEmail,
    sendSubscriptionSuccessEmail,
    sendSubscriptionFailedEmail,
    sendNewMessageNotification,
    sendGuardianWelcomeEmail,
    sendGuardianMessageNotification,
    sendGuardianSubscriptionSuccessEmail,
    sendGuardianSubscriptionFailedEmail,
    sendSubscription7DayWarningEmail,
    sendSubscription3DayWarningEmail,
    sendSubscriptionExpiryTodayEmail,
    sendSubscriptionRenewedEmail,
    sendGuardianSubscription7DayWarningEmail,
    sendGuardianSubscription3DayWarningEmail,
    sendGuardianSubscriptionExpiryTodayEmail,
    sendGuardianSubscriptionRenewedEmail,
};
