
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

const {
  generateReportCard,
  generateReportCardExcel
} = require('../controllers/reportController');

// Student authentication and authorization
router.use(protect);
router.use(authorize('student'));

// Dashboard
router.get('/dashboard', getDashboard);

// Attendance
router.post('/attendance', markAttendance);
router.get('/attendance', getAttendanceHistory);

// Academic information
router.get('/timetable', getTimetable);
router.get('/results', getResults);
router.get('/exams', getExamSchedule);

// Notices and materials
router.get('/notices', getNotices);
router.get('/materials', getStudentMaterials);

// Student report card
router.get('/report-card/:studentId', generateReportCard);
router.get('/report-card/excel/:studentId', generateReportCardExcel);

module.exports = router;
