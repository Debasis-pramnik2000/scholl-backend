const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getParentDashboard,
  getChildAttendance,
  getChildResults,
  updateParentProfile,
  getParentNotices,
  getChildReportCard
} = require('../controllers/parentController');

router.use(protect);
router.use(authorize('parent'));

router.get('/dashboard', getParentDashboard);
router.get('/notices', getParentNotices);
router.get('/attendance/:childId', getChildAttendance);
router.get('/results/:childId', getChildResults);
router.put('/profile', updateParentProfile);
router.get('/report-card/:childId', getChildReportCard);

module.exports = router;