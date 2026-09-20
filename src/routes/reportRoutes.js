const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  generateReportCard,
  generateReportCardExcel,
  generateClassReport,
  generateAttendanceReport,
  generateTeacherReport,
  downloadBulkReport
} = require('../controllers/reportController');

// ==================== STUDENT REPORT ROUTES ====================
// All routes require authentication

router.use(protect);

// ✅ Student - Generate Report Card PDF
router.get('/report-card/:studentId', authorize('student', 'parent'), generateReportCard);

// ✅ Student - Generate Report Card Excel
router.get('/report-card/excel/:studentId', authorize('student', 'parent'), generateReportCardExcel);

// ✅ Student - Generate Class Report (Admin only)
router.get('/class-report/:classId', authorize('admin'), generateClassReport);

// ✅ Student - Generate Attendance Report (Admin/Teacher)
router.get('/attendance-report/:classId', authorize('admin', 'teacher'), generateAttendanceReport);

// ✅ Student - Generate Teacher Report (Admin only)
router.get('/teacher-report/:teacherId', authorize('admin'), generateTeacherReport);

// ✅ Student - Download Bulk Reports (Admin only)
router.post('/bulk-download', authorize('admin'), downloadBulkReport);

module.exports = router;