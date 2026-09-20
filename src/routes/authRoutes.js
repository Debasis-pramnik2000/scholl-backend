const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const processImage = require('../middleware/imageProcessor');

const {
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  uploadProfilePhoto,
  removeProfilePhoto
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

router.post('/login', login);

router.get('/me', protect, getMe);

router.put('/profile', protect, updateProfile);

router.put('/change-password', protect, changePassword);

router.post('/forgot-password', forgotPassword);

router.put('/reset-password', resetPassword);

router.post(
  '/upload-photo',
  protect,
  upload.single('profilePhoto'),
  processImage,
  uploadProfilePhoto
);

router.delete(
  '/remove-photo',
  protect,
  removeProfilePhoto
);

module.exports = router;