const { getDB } = require("../config/db");
const { createError } = require("../utils/errorHandler");
const logger = require("../utils/logger");

const requestPhoto = async (req, res, next) => {
  try {
    const { targetId } = req.body;
    const db = getDB();

    const request = {
      requesterId: new ObjectId(req.user.id),
      targetId: new ObjectId(targetId),
      status: "pending",
      timestamp: new Date(),
    };

    await db.collection("photoRequests").insertOne(request);
    logger.info(`Photo request sent from ${req.user.id} to ${targetId}`);
    res.json({ message: "Photo request sent" });
  } catch (error) {
    next(error);
  }
};

const respondPhotoRequest = async (req, res, next) => {
  try {
    const { requestId, status } = req.body;
    const db = getDB();

    const result = await db
      .collection("photoRequests")
      .updateOne(
        { _id: new ObjectId(requestId), targetId: new ObjectId(req.user.id) },
        { $set: { status } }
      );

    if (result.matchedCount === 0)
      throw createError(404, "Photo request not found");

    logger.info(`Photo request ${requestId} responded with status ${status}`);
    res.json({ message: `Photo request ${status}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { requestPhoto, respondPhotoRequest };
