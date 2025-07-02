const { createError } = require("../utils/errorHandler");
const { getDB } = require("../config/connectDB");
const cloudinary = require("cloudinary").v2;
const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");
const { ObjectId } = require("mongodb");

const uploadPhoto = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { photo } = req.body;

    if (!photo) {
      throw createError(400, "Photo data is required");
    }

    const uploadResult = await cloudinary.uploader.upload(photo, {
      folder: "unistudents-match",
      allowed_formats: ["jpg", "jpeg", "png"],
    });

    if (
      uploadResult.moderation &&
      uploadResult.moderation.status === "rejected"
    ) {
      throw createError(400, "Inappropriate content detected in photo");
    }

    const db = getDB();
    const photoData = {
      userId,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      createdAt: new Date(),
    };

    const result = await db.collection("photos").insertOne(photoData);

    res
      .status(201)
      .json({ photoId: result.insertedId, url: uploadResult.secure_url });
  } catch (error) {
    logger.error(`Error uploading photo: ${error.message}`);
    next(error);
  }
};

const getPhotos = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.query;

    const db = getDB();
    let photos = [];

    if (targetUserId) {
      // Check mutual photo access
      const mutualRequest = await db.collection("photoRequests").findOne({
        $or: [
          { requesterId: userId, targetUserId, status: "accepted" },
          {
            requesterId: targetUserId,
            targetUserId: userId,
            status: "accepted",
          },
        ],
      });

      if (!mutualRequest) {
        throw createError(403, "No mutual photo access granted");
      }

      photos = await db
        .collection("photos")
        .find({ userId: targetUserId })
        .toArray();
    } else {
      photos = await db.collection("photos").find({ userId }).toArray();
    }

    res.status(200).json(
      photos.map((p) => ({
        id: p._id,
        url: p.cloudinaryUrl,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    logger.error(`Error fetching photos: ${error.message}`);
    next(error);
  }
};

const requestPhotoAccess = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      throw createError(400, "Target user ID is required");
    }

    const db = getDB();
    const existingRequest = await db.collection("photoRequests").findOne({
      requesterId: userId,
      targetUserId,
      status: "pending",
    });

    if (existingRequest) {
      throw createError(400, "Photo access request already pending");
    }

    const request = {
      requesterId: userId,
      targetUserId,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await db.collection("photoRequests").insertOne(request);

    const targetUser = await userService.findUserById(targetUserId);
    if (targetUser.gender === "female" && targetUser.guardianEmail) {
      await notificationService.notifyGuardian(
        targetUser.guardianEmail,
        targetUser.firstName,
        "photoRequest",
        userId
      );
    }

    res.status(201).json({ requestId: result.insertedId, status: "pending" });
  } catch (error) {
    logger.error(`Error requesting photo access: ${error.message}`);
    next(error);
  }
};

const respondToPhotoRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { requestId, accept } = req.body;

    if (!requestId || typeof accept !== "boolean") {
      throw createError(400, "Request ID and accept status are required");
    }

    const db = getDB();
    const request = await db
      .collection("photoRequests")
      .findOne({ _id: new ObjectId(requestId) });
    if (!request || request.targetUserId !== userId) {
      throw createError(404, "Photo request not found or unauthorized");
    }

    const status = accept ? "accepted" : "rejected";
    await db
      .collection("photoRequests")
      .updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { status, updatedAt: new Date() } }
      );

    if (accept) {
      const reciprocalRequest = await db.collection("photoRequests").findOne({
        requesterId: userId,
        targetUserId: request.requesterId,
        status: "accepted",
      });

      if (!reciprocalRequest) {
        await db.collection("photoRequests").insertOne({
          requesterId: userId,
          targetUserId: request.requesterId,
          status: "accepted",
          createdAt: new Date(),
        });
      }
    }

    res.status(200).json({ requestId, status });
  } catch (error) {
    logger.error(`Error responding to photo request: ${error.message}`);
    next(error);
  }
};

module.exports = {
  uploadPhoto,
  getPhotos,
  requestPhotoAccess,
  respondToPhotoRequest,
};
