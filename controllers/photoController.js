const cloudinary = require("cloudinary").v2;
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const userService = require("../services/userService");
const { getDB } = require("../config/db");
const fs = require("fs").promises;
const { ObjectId } = require("mongodb");

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  logger.error(
    "Cloudinary credentials are not fully configured in environment variables. Photo upload/delete will fail."
  );
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info("Cloudinary configured successfully.");
}

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "unistudents_match_profile_photos",
      quality: "auto:low",
      fetch_format: "auto",
    });

    if (!result || !result.secure_url || !result.public_id) {
      throw new Error("Cloudinary upload failed: Invalid response");
    }

    const db = getDB();
    const photoCollection = db.collection("photos");

    const newPhoto = {
      userId: new ObjectId(req.user.userId),
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      createdAt: new Date(),
    };

    const insertResult = await photoCollection.insertOne(newPhoto);

    if (!insertResult.acknowledged) {
      throw new Error("Failed to save photo metadata to database");
    }

    await fs.unlink(req.file.path);

    res.status(201).json({
      message: "Photo uploaded successfully",
      photo: { ...newPhoto, _id: insertResult.insertedId },
    });
  } catch (error) {
    console.log(error)
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("Failed to delete temporary file:", unlinkError);
      }
    }
    res.status(500).json({ message: error.message });
  }
};

const getUserPhotos = async (req, res, next) => {
  try {
    const db = getDB();
    const photoCollection = db.collection("photos");

    const photos = await photoCollection
      .find({ userId: new ObjectId(req.user.userId) })
      .toArray();
    res.status(200).json(photos);
  } catch (error) {
    logger.error(
      `Error fetching photos for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const deletePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const photoCollection = db.collection("photos");

    const photo = await photoCollection.findOne({ _id: new ObjectId(id) });

    if (!photo) {
      throw createError(404, "Photo not found");
    }

    if (photo.userId.toString() !== req.user.userId) {
      throw createError(403, "Unauthorized to delete this photo");
    }

    await cloudinary.uploader.destroy(photo.cloudinaryPublicId);

    const deleteResult = await photoCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (deleteResult.deletedCount === 0) {
      throw createError(500, "Failed to delete photo from database");
    }

    logger.info(`Photo ${id} deleted by user ${req.user.userId}`);
    res.status(200).json({ message: "Photo deleted successfully" });
  } catch (error) {
    logger.error(
      `Error deleting photo ${req.params.id} for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const requestPhoto = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    const requesterId = req.user.userId;

    if (!targetUserId) {
      throw createError(400, "Target user ID is required");
    }

    if (requesterId === targetUserId) {
      throw createError(400, "Cannot request photos from yourself");
    }

    const targetUser = await userService.findUserById(targetUserId);
    if (!targetUser) {
      throw createError(404, "Target user not found");
    }

    const db = getDB();
    const photoRequestCollection = db.collection("photorequests");

    const existingRequest = await photoRequestCollection.findOne({
      requesterId: new ObjectId(requesterId),
      targetUserId: new ObjectId(targetUserId),
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      throw createError(
        409,
        `Photo request already ${existingRequest.status} for this user.`
      );
    }

    const newRequest = {
      requesterId: new ObjectId(requesterId),
      targetUserId: new ObjectId(targetUserId),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await photoRequestCollection.insertOne(newRequest);

    if (!insertResult.acknowledged) {
      throw new Error("Failed to save photo request to database");
    }

    logger.info(`Photo request sent from ${requesterId} to ${targetUserId}`);
    res.status(201).json({
      message: "Photo request sent successfully",
      request: { ...newRequest, _id: insertResult.insertedId },
    });
  } catch (error) {
    logger.error(
      `Error sending photo request from ${req.user?.userId} to ${req.body.targetUserId}: ${error.message}`
    );
    next(error);
  }
};

const getSentPhotoRequests = async (req, res, next) => {
  try {
    const db = getDB();
    const photoRequestCollection = db.collection("photorequests");
    const userCollection = db.collection("users");

    const requests = await photoRequestCollection
      .aggregate([
        {
          $match: { requesterId: new ObjectId(req.user.userId) },
        },
        {
          $lookup: {
            from: "users",
            localField: "targetUserId",
            foreignField: "_id",
            as: "targetUser",
          },
        },
        {
          $unwind: "$targetUser",
        },
        {
          $project: {
            _id: 1,
            requesterId: 1,
            targetUserId: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            "targetUser.firstName": 1,
            "targetUser.lastName": 1,
          },
        },
      ])
      .toArray();

    const formattedRequests = requests.map((request) => ({
      ...request,
      targetUserId: {
        _id: request.targetUser._id,
        firstName: request.targetUser.firstName,
        lastName: request.targetUser.lastName,
      },
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    logger.error(
      `Error fetching sent photo requests for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const getReceivedPhotoRequests = async (req, res, next) => {
  try {
    const db = getDB();
    const photoRequestCollection = db.collection("photorequests");
    const userCollection = db.collection("users");

    const requests = await photoRequestCollection
      .aggregate([
        {
          $match: { targetUserId: new ObjectId(req.user.userId) },
        },
        {
          $lookup: {
            from: "users",
            localField: "requesterId",
            foreignField: "_id",
            as: "requesterUser",
          },
        },
        {
          $unwind: "$requesterUser",
        },
        {
          $project: {
            _id: 1,
            requesterId: 1,
            targetUserId: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            "requesterUser.firstName": 1,
            "requesterUser.lastName": 1,
          },
        },
      ])
      .toArray();

    const formattedRequests = requests.map((request) => ({
      ...request,
      requesterId: {
        _id: request.requesterUser._id,
        firstName: request.requesterUser.firstName,
        lastName: request.requesterUser.lastName,
      },
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    logger.error(
      `Error fetching received photo requests for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const respondToPhotoRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user.userId;

    if (!["accepted", "rejected"].includes(status)) {
      throw createError(
        400,
        'Invalid status provided. Must be "accepted" or "rejected".'
      );
    }

    const db = getDB();
    const photoRequestCollection = db.collection("photorequests");

    const request = await photoRequestCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      throw createError(404, "Photo request not found");
    }

    if (request.targetUserId.toString() !== currentUserId) {
      throw createError(403, "Unauthorized to respond to this request");
    }

    if (request.status !== "pending") {
      throw createError(400, `Request already ${request.status}`);
    }

    const updateResult = await photoRequestCollection.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: status, updatedAt: new Date() } }
    );

    if (updateResult.modifiedCount === 0) {
      throw createError(500, "Failed to update photo request status");
    }

    const updatedRequest = await photoRequestCollection.findOne({
      _id: new ObjectId(requestId),
    });

    logger.info(
      `Photo request ${requestId} ${status} by user ${currentUserId}`
    );
    res
      .status(200)
      .json({ message: `Photo request ${status}`, request: updatedRequest });
  } catch (error) {
    logger.error(
      `Error responding to photo request ${req.params.requestId} by user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const getSingleUserProfileWithPhotos = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user.userId;

    if (!targetUserId) {
      throw createError(400, "User ID is required");
    }

    const targetUser = await userService.findUserById(targetUserId);
    if (!targetUser) {
      throw createError(404, "User not found");
    }

    const db = getDB();
    const photoCollection = db.collection("photos");
    const photoRequestCollection = db.collection("photorequests");

    let photos = [];
    let photoAccessStatus = "restricted";

    if (currentUserId === targetUserId) {
      photos = await photoCollection
        .find({ userId: new ObjectId(targetUserId) })
        .toArray();
      photoAccessStatus = "granted_self";
    } else {
      const acceptedRequest = await photoRequestCollection.findOne({
        requesterId: new ObjectId(currentUserId),
        targetUserId: new ObjectId(targetUserId),
        status: "accepted",
      });

      if (acceptedRequest) {
        photos = await photoCollection
          .find({ userId: new ObjectId(targetUserId) })
          .toArray();
        photoAccessStatus = "granted_by_request";
      } else {
        const pendingRequest = await photoRequestCollection.findOne({
          requesterId: new ObjectId(currentUserId),
          targetUserId: new ObjectId(targetUserId),
          status: "pending",
        });
        if (pendingRequest) {
          photoAccessStatus = "pending";
        } else {
          const rejectedRequest = await photoRequestCollection.findOne({
            requesterId: new ObjectId(currentUserId),
            targetUserId: new ObjectId(targetUserId),
            status: "rejected",
          });
          if (rejectedRequest) {
            photoAccessStatus = "rejected";
          }
        }
      }
    }

    const profileData = {
      _id: targetUser._id,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      age: targetUser.age,
      gender: targetUser.gender,
      university: targetUser.university,
      status: targetUser.status,
      description: targetUser.description,
      lookingFor: targetUser.lookingFor,
      photos: photos.map((p) => ({ id: p._id, url: p.cloudinaryUrl })),
      photoAccessStatus: photoAccessStatus,
    };

    res.status(200).json(profileData);
  } catch (error) {
    logger.error(
      `Error fetching user profile with photos for user ${req.params.userId}: ${error.message}`
    );
    next(error);
  }
};

module.exports = {
  uploadPhoto,
  getUserPhotos,
  deletePhoto,
  requestPhoto,
  getSentPhotoRequests,
  getReceivedPhotoRequests,
  respondToPhotoRequest,
  getSingleUserProfileWithPhotos,
};
