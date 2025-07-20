const cloudinary = require('cloudinary').v2;
const Photo = require('../models/photoModel');
const PhotoRequest = require('../models/photoRequestModel');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'profile_photos', 
    });

    const newPhoto = new Photo({
      userId: req.user.id, 
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
    });

    await newPhoto.save();
    res.status(201).json({ message: 'Photo uploaded successfully', photo: newPhoto });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error during photo upload' });
  }
};

exports.getUserPhotos = async (req, res) => {
  try {
    const photos = await Photo.find({ userId: req.user.id });
    res.status(200).json(photos);
  } catch (error) {
    console.error('Error fetching user photos:', error);
    res.status(500).json({ message: 'Server error fetching photos' });
  }
};

exports.deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (photo.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to delete this photo' });
    }

    await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
    await photo.deleteOne();
    res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ message: 'Server error during photo deletion' });
  }
};

exports.requestPhoto = async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    if (req.user.id === targetUserId) {
      return res.status(400).json({ message: 'Cannot request photos from yourself' });
    }

    
    const existingRequest = await PhotoRequest.findOne({
      requesterId: req.user.id,
      targetUserId: targetUserId,
      status: { $in: ['pending', 'accepted'] }, 
    });

    if (existingRequest) {
      return res.status(409).json({ message: 'Photo request already sent or accepted' });
    }

    const newRequest = new PhotoRequest({
      requesterId: req.user.id,
      targetUserId: targetUserId,
      status: 'pending',
    });

    await newRequest.save();
    res.status(201).json({ message: 'Photo request sent successfully', request: newRequest });
  } catch (error) {
    console.error('Error sending photo request:', error);
    res.status(500).json({ message: 'Server error sending request' });
  }
};

exports.getSentPhotoRequests = async (req, res) => {
  try {
    const requests = await PhotoRequest.find({ requesterId: req.user.id }).populate('targetUserId', 'firstName lastName');
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching sent photo requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
};

exports.getReceivedPhotoRequests = async (req, res) => {
  try {
    const requests = await PhotoRequest.find({ targetUserId: req.user.id }).populate('requesterId', 'firstName lastName');
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching received photo requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
};

exports.respondToPhotoRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; 

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided' });
    }

    const request = await PhotoRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: 'Photo request not found' });
    }

    if (request.targetUserId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = status;
    await request.save();

    res.status(200).json({ message: `Photo request ${status}`, request });
  } catch (error) {
    console.error('Error responding to photo request:', error);
    res.status(500).json({ message: 'Server error responding to request' });
  }
};
