const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

const {
  // Dashboard
  getDashboardStats,

  // Student Management
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentPassword,

  // Teacher Management
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  resetTeacherPassword,
  assignClassTeacher,

  // Class Management
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  addSubjectToClass,
  removeSubjectFromClass,

  // Timetable
  getTimetable,
  createTimetable,
  deleteTimetable,

  // Attendance Reports
  getAttendanceReports,

  // Exam Management
  createExam,
  publishResult,
  getExams,

  // Notice Management
  createNotice,
  getNotices,
  updateNotice,
  deleteNotice,

  // Subject Management
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignTeacher,

  // Profile
  updateAdminProfile,
  updateAdminProfilePhoto,
   createParent,
  getParents,
  getParentById,
  updateParent,
  deleteParent,
  resetParentPassword
} = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Student Management
router.get('/students', getStudents);
router.get('/students/:id', getStudentById);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.put('/students/:id/reset-password', resetStudentPassword);

// Teacher Management
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/teachers/:id', updateTeacher);
router.delete('/teachers/:id', deleteTeacher);
router.put('/teachers/:id/reset-password', resetTeacherPassword);

// Assign class teacher
router.put('/classes/:id/assign-teacher', assignClassTeacher);

// Class Management
router.get('/classes', getClasses);
router.post('/classes', createClass);
router.put('/classes/:id', updateClass);
router.delete('/classes/:id', deleteClass);

// Class - Subject Assignment
router.post('/classes/:id/subjects', addSubjectToClass);
router.delete('/classes/:id/subjects/:subjectId', removeSubjectFromClass);

// Timetable
router.get('/timetable', getTimetable);
router.post('/timetable', createTimetable);
router.delete('/timetable/:id', deleteTimetable);

// Attendance Reports
router.get('/attendance-reports', getAttendanceReports);

// Exam Management
router.get('/exams', getExams);
router.post('/exams', createExam);
router.put('/exams/:id/publish', publishResult);

// Subject Management
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.get('/subjects/:id', getSubjectById);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);
router.put('/subjects/:id/assign-teacher', assignTeacher);

// Notice Management
router.get('/notices', getNotices);
router.post('/notices', createNotice);
router.put('/notices/:id', updateNotice);
router.delete('/notices/:id', deleteNotice);

// Admin Profile
router.put('/profile', updateAdminProfile);
router.put('/profile-photo', updateAdminProfilePhoto);  // ✅ Add this
router.get('/parents', getParents);
router.get('/parents/:id', getParentById);
router.post('/parents', createParent);
router.put('/parents/:id', updateParent);
router.delete('/parents/:id', deleteParent);
router.put('/parents/:id/reset-password', resetParentPassword);
module.exports = router;
 