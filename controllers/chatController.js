const { createError } = require("../utils/errorHandler");
const { getDB } = require("../config/connectDB");
const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");
const { moderateContent } = require("../services/moderationService");
const { ObjectId } = require("mongodb");

const getChats = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const db = getDB();
    const messages = await db
      .collection("messages")
      .aggregate([
        {
          $match: {
            $or: [{ senderId: userId }, { receiverId: userId }],
          },
        },
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", userId] },
                "$receiverId",
                "$senderId",
              ],
            },
            lastMessage: { $first: "$content" },
            timestamp: { $first: "$timestamp" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            id: "$_id",
            user: {
              id: "$user._id",
              firstName: "$user.firstName",
              lastName: "$user.lastName",
            },
            lastMessage: 1,
            timestamp: 1,
          },
        },
      ])
      .toArray();

    res.status(200).json(messages);
  } catch (error) {
    logger.error(`Error fetching chats: ${error.message}`);
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      throw createError(400, "Receiver ID and content are required");
    }

    const cleanedContent = await moderateContent(content);
    const db = getDB();
    const message = {
      senderId: userId,
      receiverId,
      content: cleanedContent,
      timestamp: new Date(),
    };

    const result = await db.collection("messages").insertOne(message);

    const receiver = await userService.findUserById(receiverId);
    if (receiver.gender === "female" && receiver.guardianEmail) {
      await notificationService.notifyGuardian(
        receiver.guardianEmail,
        receiver.firstName,
        "message",
        userId
      );
    }

    const io = req.app.get("io");
    io.to(receiverId).emit("newMessage", {
      id: result.insertedId,
      senderId: userId,
      receiverId,
      content: cleanedContent,
      timestamp: message.timestamp,
    });

    res.status(201).json({
      id: result.insertedId,
      senderId: userId,
      receiverId,
      content: cleanedContent,
      timestamp: message.timestamp,
    });
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { otherUserId } = req.params;

    if (!otherUserId) {
      throw createError(400, "Other user ID is required");
    }

    const db = getDB();
    const messages = await db
      .collection("messages")
      .find({
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      })
      .sort({ timestamp: 1 })
      .toArray();

    res.status(200).json(
      messages.map((m) => ({
        id: m._id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        timestamp: m.timestamp,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching messages: ${error.message}`);
    next(error);
  }
};

module.exports = { getChats, sendMessage, getMessages };
