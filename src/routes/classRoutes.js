const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  addSubjectToClass,
  removeSubjectFromClass,
  assignClassTeacher,
  getClassStats,
  searchClasses
} = require('../controllers/classController');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Class statistics
router.get('/stats', getClassStats);

// Search classes
router.get('/search', searchClasses);

// Main CRUD routes
router.route('/')
  .get(getClasses)
  .post(createClass);

router.route('/:id')
  .get(getClassById)
  .put(updateClass)
  .delete(deleteClass);

// Subject management
router.post('/:id/subjects', addSubjectToClass);
router.delete('/:id/subjects/:subjectId', removeSubjectFromClass);

// Class teacher assignment
router.put('/:id/assign-teacher', assignClassTeacher);

module.exports = router;