const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  markAttendance,
  getAttendanceHistory,
  getTimetable,
  getResults,
  getExamSchedule,
  getNotices,
    getStudentMaterials  

} = require('../controllers/studentController');

// All routes require authentication and student role
router.use(protect);
router.use(authorize('student'));

router.get('/dashboard', getDashboard);
router.post('/attendance', markAttendance);
router.get('/attendance', getAttendanceHistory);
router.get('/timetable', getTimetable);
router.get('/results', getResults);
router.get('/exams', getExamSchedule);
router.get('/notices', getNotices);
router.get('/materials', getStudentMaterials);  // ✅ Add this route

module.exports = router;