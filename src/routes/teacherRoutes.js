const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  // Dashboard
  getTeacherDashboard,
  
  // Class Management
  getAssignedClasses,
  getClassStudents,
  
  // Attendance
  markStudentAttendance,
  getClassAttendance,
  getAttendanceReport,
  
  // Marks/Grades
  enterMarks,
  getClassMarks,
  updateMarks,
  getStudentMarks,
  
  // Study Materials
  uploadStudyMaterial,
  getStudyMaterials,
  deleteStudyMaterial,
  
  // Profile
  updateTeacherProfile,
  changeTeacherPassword,
  
  // Notices
  getTeacherNotices,
  
  // Timetable
  getTeacherTimetable,
  
  // Students
  getTeacherStudents
} = require('../controllers/teacherController');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher'));

// ==================== DASHBOARD ====================
router.get('/dashboard', getTeacherDashboard);

// ==================== CLASS MANAGEMENT ====================
router.get('/classes', getAssignedClasses);
router.get('/classes/:classId/students', getClassStudents);

// ==================== ATTENDANCE ====================
router.post('/attendance', markStudentAttendance);
router.get('/attendance/:classId', getClassAttendance);
router.get('/attendance/report/:classId', getAttendanceReport);

// ==================== MARKS/GRADES ====================
router.post('/marks', enterMarks);
router.get('/marks/:classId', getClassMarks);
router.put('/marks/:markId', updateMarks);
router.get('/marks/student/:studentId', getStudentMarks);

// ==================== STUDY MATERIALS ====================
router.post('/materials', uploadStudyMaterial);
router.get('/materials', getStudyMaterials);
router.delete('/materials/:id', deleteStudyMaterial);

// ==================== PROFILE ====================
router.put('/profile', updateTeacherProfile);
router.put('/change-password', changeTeacherPassword);

// ==================== NOTICES ====================
router.get('/notices', getTeacherNotices);

// ==================== TIMETABLE ====================
router.get('/timetable', getTeacherTimetable);

// ==================== STUDENTS ====================
router.get('/students', getTeacherStudents);

module.exports = router;