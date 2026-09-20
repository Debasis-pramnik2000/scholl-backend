const express = require('express');
const router = express.Router();

// ✅ FIXED: Import admissionFields (not upload)
const { admissionFields } = require('../middleware/upload');

const {
  submitApplication,
  checkStatus
} = require('../controllers/admissionController');

// ==================== PUBLIC ROUTES ====================
// No authentication required

// @route   POST /api/admission/apply
// @desc    Submit admission application
// @access  Public
router.post('/apply', admissionFields, submitApplication);

// @route   GET /api/admission/status/:applicationNumber
// @desc    Check application status
// @access  Public
router.get('/status/:applicationNumber', checkStatus);

module.exports = router;