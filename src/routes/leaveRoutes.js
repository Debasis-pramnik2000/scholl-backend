const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
  getLeaveReports
} = require('../controllers/leaveController');

// Protected routes (Student/Teacher)
router.use(protect);

router.post('/apply', applyLeave);
router.get('/my-leaves', getMyLeaves);

// Admin routes
router.use(authorize('admin'));
router.get('/all', getAllLeaves);
router.put('/:id', updateLeaveStatus);
router.get('/reports', getLeaveReports);

module.exports = router;