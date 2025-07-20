const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const authenticate = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', authenticate, upload.single('image'), photoController.uploadPhoto);
router.get('/', authenticate, photoController.getUserPhotos);
router.delete('/:id', authenticate, photoController.deletePhoto);

router.post('/request', authenticate, photoController.requestPhoto);
router.get('/requests/sent', authenticate, photoController.getSentPhotoRequests);
router.get('/requests/received', authenticate, photoController.getReceivedPhotoRequests);
router.put('/requests/:requestId/respond', authenticate, photoController.respondToPhotoRequest);

module.exports = router;
