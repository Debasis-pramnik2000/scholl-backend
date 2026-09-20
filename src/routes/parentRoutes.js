const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getParentDashboard,
  getChildAttendance,
  getChildResults,
  updateParentProfile
} = require('../controllers/parentController');

router.use(protect);
router.use(authorize('parent'));

router.get('/dashboard', getParentDashboard);
router.get('/attendance/:childId', getChildAttendance);
router.get('/results/:childId', getChildResults);
router.put('/profile', updateParentProfile);

module.exports = router;