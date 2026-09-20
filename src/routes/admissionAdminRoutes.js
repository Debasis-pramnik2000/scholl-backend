const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  getAllAdmissions,
  getAdmissionById,
  approveAdmission,
  rejectAdmission,
  deleteAdmission,
  getAdmissionStats,
  bulkApproveAdmissions,
  exportAdmissions
} = require('../controllers/admissionController');

// ==================== ADMIN ROUTES ====================
// All routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

// ⚠️ IMPORTANT: Specific routes MUST be BEFORE /:id

// @route   GET /api/admin/admissions/stats
router.get('/stats', getAdmissionStats);

// @route   GET /api/admin/admissions/export
router.get('/export', exportAdmissions);

// @route   POST /api/admin/admissions/bulk-approve
router.post('/bulk-approve', bulkApproveAdmissions);

// @route   GET /api/admin/admissions
router.get('/', getAllAdmissions);

// @route   GET /api/admin/admissions/:id
router.get('/:id', getAdmissionById);

// @route   PUT /api/admin/admissions/:id/approve
router.put('/:id/approve', approveAdmission);

// @route   PUT /api/admin/admissions/:id/reject
router.put('/:id/reject', rejectAdmission);

// @route   DELETE /api/admin/admissions/:id
router.delete('/:id', deleteAdmission);

module.exports = router;