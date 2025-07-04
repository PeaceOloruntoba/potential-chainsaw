// services/notificationService.js
const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const notifyGuardian = async (
  guardianEmail,
  userFirstName,
  eventType,
  requesterId = null
) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.error(
        "Email user or password environment variables are not set for Nodemailer."
      );
      throw new Error("Email service not configured.");
    }

    let subject, text;
    switch (eventType) {
      case "registration":
        subject = `Unistudents Match: New User Registration`;
        text = `Dear Guardian,\n\n${userFirstName} has registered on Unistudents Match.\n\nBest regards,\nUnistudents Match Team`;
        break;
      case "message":
        subject = `Unistudents Match: New Message for ${userFirstName}`;
        text = `Dear Guardian,\n\n${userFirstName} has received a new message from user ID ${requesterId}.\n\nBest regards,\nUnistudents Match Team`;
        break;
      case "photoRequest":
        subject = `Unistudents Match: Photo Access Request for ${userFirstName}`;
        text = `Dear Guardian,\n\n${userFirstName} has received a photo access request from user ID ${requesterId}.\n\nBest regards,\nUnistudents Match Team`;
        break;
      default:
        throw createError(400, "Invalid notification event type");
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: guardianEmail,
      subject,
      text,
    });

    logger.info(
      `Notification sent to ${guardianEmail} for event: ${eventType}`
    );
  } catch (error) {
    logger.error(
      `Error sending notification to ${guardianEmail}: ${error.message}`
    );
    throw error;
  }
};

module.exports = { notifyGuardian };
