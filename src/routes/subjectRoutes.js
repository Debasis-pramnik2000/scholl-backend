const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignTeacher,
  getTeacherSubjects,
  getStudentSubjects
} = require('../controllers/subjectController');

// All routes require authentication
router.use(protect);

// Student routes
router.get('/student', authorize('student'), getStudentSubjects);

// Teacher routes
router.get('/teacher', authorize('teacher'), getTeacherSubjects);

// Admin routes - all below require admin role
router.use(authorize('admin'));

// Main CRUD routes
router.route('/')
  .get(getSubjects)
  .post(createSubject);

router.route('/:id')
  .get(getSubjectById)
  .put(updateSubject)
  .delete(deleteSubject);

// Assign teacher to subject
router.put('/:id/assign-teacher', assignTeacher);

module.exports = router;