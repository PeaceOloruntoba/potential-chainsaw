const express = require('express');
const router = express.Router();
const { uploadPhoto} = require('../controllers/photoController');
const authenticate = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', authenticate, upload.single('image'), uploadPhoto);
router.get('/', authenticate, getUserPhotos);
router.delete('/:id', authenticate, deletePhoto);

router.post('/request', authenticate, requestPhoto);
router.get('/requests/sent', authenticate, getSentPhotoRequests);
router.get('/requests/received', authenticate, getReceivedPhotoRequests);
router.put('/requests/:requestId/respond', authenticate, respondToPhotoRequest);

module.exports = router;
