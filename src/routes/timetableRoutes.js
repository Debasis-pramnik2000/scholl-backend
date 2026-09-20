const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  // Admin routes
  getTimetables,
  getTimetableById,
  getTimetableByClass,
  createTimetable,
  updateTimetable,
  deleteTimetable,
  copyTimetable,
  getTimetableReport,
  
  // Teacher route
  getTeacherTimetable,
  
  // Student route
  getStudentTimetable
} = require('../controllers/timetableController');

// ==================== ADMIN ROUTES ====================
router.use(protect);

// Student routes
router.get('/student', authorize('student'), getStudentTimetable);

// Teacher routes
router.get('/teacher', authorize('teacher'), getTeacherTimetable);

// Admin routes - all below require admin role
router.use(authorize('admin'));

// Main CRUD routes
router.route('/')
  .get(getTimetables)
  .post(createTimetable);

router.get('/report', getTimetableReport);
router.get('/class/:className/:section', getTimetableByClass);
router.post('/copy', copyTimetable);

router.route('/:id')
  .get(getTimetableById)
  .put(updateTimetable)
  .delete(deleteTimetable);

module.exports = router;