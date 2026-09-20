const express = require('express');
const router = express.Router();
const {
  getPublicNotices,
  getPublicNoticeById,
  downloadNoticePDF
} = require('../controllers/publicController');

// Public routes - no authentication required
router.get('/notices', getPublicNotices);
router.get('/notices/:id', getPublicNoticeById);
router.get('/notices/:id/pdf', downloadNoticePDF);

module.exports = router;