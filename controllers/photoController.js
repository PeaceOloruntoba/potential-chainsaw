const cloudinary = require("cloudinary").v2;
const Photo = require("../models/photoModel");
const PhotoRequest = require("../models/photoRequestModel");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const userService = require("../services/userService");

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

const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError(400, "No image file provided");
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "unistudents_match_profile_photos",
      quality: "auto:low",
      fetch_format: "auto",
    });

    const newPhoto = new Photo({
      userId: req.user.userId,
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
    });

    await newPhoto.save();
    logger.info(
      `Photo uploaded by user ${req.user.userId}: ${newPhoto.cloudinaryUrl}`
    );
    res
      .status(201)
      .json({ message: "Photo uploaded successfully", photo: newPhoto });
  } catch (error) {
    logger.error(
      `Error uploading photo for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const getUserPhotos = async (req, res, next) => {
  try {
    const photos = await Photo.find({ userId: req.user.userId });
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
    const photo = await Photo.findById(id);

    if (!photo) {
      throw createError(404, "Photo not found");
    }

    if (photo.userId.toString() !== req.user.userId) {
      throw createError(403, "Unauthorized to delete this photo");
    }

    await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
    await photo.deleteOne();
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

    const existingRequest = await PhotoRequest.findOne({
      requesterId: requesterId,
      targetUserId: targetUserId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      throw createError(
        409,
        `Photo request already ${existingRequest.status} for this user.`
      );
    }

    const newRequest = new PhotoRequest({
      requesterId: requesterId,
      targetUserId: targetUserId,
      status: "pending",
    });

    await newRequest.save();
    logger.info(`Photo request sent from ${requesterId} to ${targetUserId}`);
    res
      .status(201)
      .json({
        message: "Photo request sent successfully",
        request: newRequest,
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
    const requests = await PhotoRequest.find({
      requesterId: req.user.userId,
    }).populate("targetUserId", "firstName lastName");
    res.status(200).json(requests);
  } catch (error) {
    logger.error(
      `Error fetching sent photo requests for user ${req.user?.userId}: ${error.message}`
    );
    next(error);
  }
};

const getReceivedPhotoRequests = async (req, res, next) => {
  try {
    const requests = await PhotoRequest.find({
      targetUserId: req.user.userId,
    }).populate("requesterId", "firstName lastName");
    res.status(200).json(requests);
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

    const request = await PhotoRequest.findById(requestId);

    if (!request) {
      throw createError(404, "Photo request not found");
    }

    if (request.targetUserId.toString() !== currentUserId) {
      throw createError(403, "Unauthorized to respond to this request");
    }

    if (request.status !== "pending") {
      throw createError(400, `Request already ${request.status}`);
    }

    request.status = status;
    request.updatedAt = new Date();
    await request.save();

    logger.info(
      `Photo request ${requestId} ${status} by user ${currentUserId}`
    );
    res.status(200).json({ message: `Photo request ${status}`, request });
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

    let photos = [];
    let photoAccessStatus = "restricted";

    if (currentUserId === targetUserId) {
      photos = await Photo.find({ userId: targetUserId });
      photoAccessStatus = "granted_self";
    } else {
      const acceptedRequest = await PhotoRequest.findOne({
        requesterId: currentUserId,
        targetUserId: targetUserId,
        status: "accepted",
      });

      if (acceptedRequest) {
        photos = await Photo.find({ userId: targetUserId });
        photoAccessStatus = "granted_by_request";
      } else {
        const pendingRequest = await PhotoRequest.findOne({
          requesterId: currentUserId,
          targetUserId: targetUserId,
          status: "pending",
        });
        if (pendingRequest) {
          photoAccessStatus = "pending";
        } else {
          const rejectedRequest = await PhotoRequest.findOne({
            requesterId: currentUserId,
            targetUserId: targetUserId,
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
