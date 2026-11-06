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

router.use(protect);
router.use(authorize('student'));

router.get('/dashboard', getDashboard);
router.post('/attendance', markAttendance);
router.get('/attendance', getAttendanceHistory);
router.get('/timetable', getTimetable);
router.get('/results', getResults);
router.get('/exams', getExamSchedule);
router.get('/notices', getNotices);
router.get('/materials', getStudentMaterials);

router.get('/report-card/:studentId', generateReportCard);
router.get('/report-card/excel/:studentId', generateReportCardExcel);

module.exports = router;