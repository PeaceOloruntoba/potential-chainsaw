// controllers/messageController.js
const { createError } = require("../utils/errorHandler");
const { getDB } = require("../config/db");
const userService = require("../services/userService");
const notificationService = require("../services/notificationService"); // Ensure this import is correct
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
                        $or: [
                            { senderId: new ObjectId(userId) },
                            { receiverId: new ObjectId(userId) },
                        ],
                    },
                },
                {
                    $sort: { timestamp: -1 },
                },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ["$senderId", new ObjectId(userId)] },
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
        const { userId: senderId } = req.user; // Rename for clarity
        const { receiverId, content } = req.body;

        if (!receiverId || !content) {
            throw createError(400, "Receiver ID and content are required");
        }
        if (!ObjectId.isValid(receiverId)) {
            throw createError(400, "Invalid receiver ID format.");
        }

        const cleanedContent = await moderateContent(content);
        const db = getDB();
        const message = {
            senderId: new ObjectId(senderId),
            receiverId: new ObjectId(receiverId),
            content: cleanedContent,
            timestamp: new Date(),
            status: "sent",
        };

        const result = await db.collection("messages").insertOne(message);

        const receiver = await userService.findUserById(receiverId);
        // We need the sender's first name for the notification email
        const sender = await userService.findUserById(senderId);
        const senderFirstName = sender ? sender.firstName : 'A user'; // Fallback if sender not found

        if (receiver) {
            // --- NEW: Notify the receiver about the new message ---
            await notificationService.notifyUser(
                receiver.email,
                receiver.firstName,
                "new_message",
                senderId // Pass senderId for email service to look up sender's name
            );

            // --- NEW: Notify guardian if the receiver is female and has a guardian email ---
            if (receiver.gender === "female" && receiver.guardianEmail) {
                await notificationService.notifyGuardian(
                    receiver.guardianEmail,
                    receiver.firstName, // Child's first name
                    "message",
                    senderId // Pass senderId for guardian email
                );
            }
        } else {
            logger.warn(`sendMessage: Receiver with ID ${receiverId} not found. Cannot send message notification.`);
        }

        const io = req.app.get("io");
        io.to(receiverId.toString()).emit("newMessage", {
            id: result.insertedId.toString(),
            senderId: senderId,
            receiverId: receiverId,
            content: cleanedContent,
            timestamp: message.timestamp,
            status: "delivered",
        });

        res.status(201).json({
            id: result.insertedId.toString(),
            senderId: senderId,
            receiverId: receiverId,
            content: cleanedContent,
            timestamp: message.timestamp,
            status: "sent",
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
        if (!ObjectId.isValid(otherUserId)) {
            throw createError(400, "Invalid other user ID format.");
        }

        const db = getDB();
        const messages = await db
            .collection("messages")
            .find({
                $or: [
                    {
                        senderId: new ObjectId(userId),
                        receiverId: new ObjectId(otherUserId),
                    },
                    {
                        senderId: new ObjectId(otherUserId),
                        receiverId: new ObjectId(userId),
                    },
                ],
            })
            .sort({ timestamp: 1 })
            .toArray();

        res.status(200).json(
            messages.map((m) => ({
                id: m._id.toString(),
                senderId: m.senderId.toString(),
                receiverId: m.receiverId.toString(),
                content: m.content,
                timestamp: m.timestamp,
                status: m.status || "sent",
            }))
        );
    } catch (error) {
        logger.error(`Error fetching messages: ${error.message}`);
        next(error);
    }
};

const markMessageAsRead = async (req, res, next) => {
    try {
        const { messageId, readerId } = req.body;

        if (!ObjectId.isValid(messageId) || !ObjectId.isValid(readerId)) {
            throw createError(400, "Invalid message ID or reader ID format.");
        }

        const db = getDB();
        const result = await db
            .collection("messages")
            .updateOne(
                { _id: new ObjectId(messageId), receiverId: new ObjectId(readerId) },
                { $set: { status: "read" } }
            );

        if (result.matchedCount === 0) {
            logger.warn(
                `markMessageAsRead: Message ${messageId} not found or not for reader ${readerId}`
            );

            return res
                .status(200)
                .json({ message: "Message status not changed or already read." });
        }

        const io = req.app.get("io");

        const message = await db
            .collection("messages")
            .findOne({ _id: new ObjectId(messageId) });
        if (message && message.senderId) {
            io.to(message.senderId.toString()).emit("messageRead", {
                messageId: messageId,
                readerId: readerId,
            });
        }

        res.status(200).json({ message: "Message marked as read" });
    } catch (error) {
        logger.error(`Error marking message as read: ${error.message}`);
        next(error);
    }
};

module.exports = { getChats, sendMessage, getMessages, markMessageAsRead };
