const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { moderateContent } = require("../services/moderationService");
const { notifyGuardian } = require("../services/notificationService");

const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content, isPhoto } = req.body;
    const db = getDB();

    const cleanContent = await moderateContent(content, isPhoto);
    const message = {
      senderId: new ObjectId(req.user.id),
      receiverId: new ObjectId(receiverId),
      content: cleanContent,
      timestamp: new Date(),
      isPhoto,
    };

    const receiver = await db
      .collection("users")
      .findOne({ _id: new ObjectId(receiverId) });
    if (!receiver) throw createError(404, "Receiver not found");

    if (receiver.gender === "female" && receiver.guardian) {
      await notifyGuardian(receiver.guardian, {
        message: "New message received",
        senderId: req.user.id,
      });
    }

    await db.collection("messages").insertOne(message);
    logger.info(`Message sent from ${req.user.id} to ${receiverId}`);
    res.json({ message: "Message sent" });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendMessage };
