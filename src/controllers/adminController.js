const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const Parent = require('../models/Parent');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ==================== DASHBOARD ====================

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalClasses = await Class.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: today },
      status: 'Present'
    });

    const recentStudents = await Student.find()
      .populate('user', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentNotices = await Notice.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const monthlyAttendance = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: startOfMonth,
            $lte: new Date()
          }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          present: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Present'] },
                1,
                0
              ]
            }
          },
          absent: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Absent'] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalClasses,
        todayAttendance,
        recentStudents,
        recentNotices,
        monthlyAttendance
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update admin profile photo
// @route   PUT /api/admin/profile-photo
// @access  Private (Admin only)
exports.updateAdminProfilePhoto = async (req, res) => {
  try {
    const { profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update admin profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== STUDENT MANAGEMENT ====================

// @desc    Get all students with pagination
// @route   GET /api/admin/students
// @access  Private (Admin only)
exports.getStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};

    if (search) {
      query = {
        $or: [
          { rollNumber: { $regex: search, $options: 'i' } },
          { class: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const students = await Student.find(query)
      .populate('user', 'name email phone profilePicture username')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Student.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single student
// @route   GET /api/admin/students/:id
// @access  Private (Admin only)
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', '-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create student
// @route   POST /api/admin/students
// @access  Private (Admin only)
exports.createStudent = async (req, res) => {
  try {
    const {
      username,
      password,
      name,
      email,
      phone,
      rollNumber,
      class: studentClass,
      section,
      academicYear,
      parentName,
      parentPhone,
      address,
      dateOfBirth,
      gender
    } = req.body;

    const finalSection = section || 'A';
    const finalYear = academicYear || new Date().getFullYear().toString();

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please use a different email.'
      });
    }

    const existingStudent = await Student.findOne({ rollNumber });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Roll number already exists'
      });
    }

    let classData = await Class.findOne({
      className: studentClass,
      section: finalSection,
      academicYear: finalYear
    });

    if (!classData) {
      classData = await Class.create({
        className: studentClass,
        section: finalSection,
        academicYear: finalYear,
        isActive: true,
        createdBy: req.user.id
      });
      console.log(`✅ Auto-created class: ${studentClass}-${finalSection} (${finalYear})`);
    }

    const user = await User.create({
      username,
      password,
      role: 'student',
      name,
      email,
      phone: phone || '',
      isActive: true
    });

    let student;
    try {
      student = await Student.create({
        user: user._id,
        rollNumber,
        class: studentClass,
        section: finalSection,
        academicYear: finalYear,
        parentName: parentName || '',
        parentPhone: parentPhone || '',
        address: address || '',
        dateOfBirth: dateOfBirth || null,
        gender: gender || 'Other'
      });
    } catch (studentError) {
      await User.findByIdAndDelete(user._id);
      throw studentError;
    }

    await Class.findByIdAndUpdate(
      classData._id,
      { $inc: { totalStudents: 1 } }
    );

    const populatedStudent = await Student.findById(student._id)
      .populate('user', '-password');

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: populatedStudent
    });
  } catch (error) {
    console.error('Create student error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update student
// @route   PUT /api/admin/students/:id
// @access  Private (Admin only)
exports.updateStudent = async (req, res) => {
  try {
    const studentId = req.params.id;

    const {
      name,
      email,
      phone,
      rollNumber,
      class: studentClass,
      section,
      academicYear,
      parentName,
      parentPhone,
      address,
      dateOfBirth,
      gender,
      isActive
    } = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await User.findByIdAndUpdate(student.user, {
      name,
      email,
      phone,
      isActive
    });

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      {
        rollNumber,
        class: studentClass,
        section,
        academicYear,
        parentName,
        parentPhone,
        address,
        dateOfBirth,
        gender
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('user', '-password');

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];

      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/admin/students/:id
// @access  Private (Admin only)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await Class.findOneAndUpdate(
      {
        className: student.class,
        section: student.section
      },
      {
        $inc: {
          totalStudents: -1
        }
      }
    );

    await User.findByIdAndDelete(student.user);
    await Student.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset student password
// @route   PUT /api/admin/students/:id/reset-password
// @access  Private (Admin only)
exports.resetStudentPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const user = await User.findById(student.user);

    user.password = newPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        username: user.username,
        newPassword
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== TEACHER MANAGEMENT ====================

// @desc    Get all teachers
// @route   GET /api/admin/teachers
// @access  Private (Admin only)
exports.getTeachers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const teachers = await Teacher.find()
      .populate('user', 'name email phone profilePicture username')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Teacher.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        teachers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get teachers error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create teacher
// @route   POST /api/admin/teachers
// @access  Private (Admin only)
exports.createTeacher = async (req, res) => {
  let createdUser = null;

  try {
    const {
      username,
      password,
      name,
      email,
      phone,
      employeeId,
      qualification,
      specialization,
      department,
      experience,
      previousInstitution,
      dateOfBirth,
      gender,
      address,
      subjects
    } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!employeeId || !employeeId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmployeeId = employeeId.trim().toUpperCase();

    const existingUser = await User.findOne({ username: cleanUsername });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const existingEmail = await User.findOne({ email: cleanEmail });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please use a different email.'
      });
    }

    const existingEmployee = await Teacher.findOne({ employeeId: cleanEmployeeId });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    let addressObj = {};

    if (address) {
      if (typeof address === 'string') {
        addressObj = { street: address.trim() };
      } else if (typeof address === 'object') {
        addressObj = {
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zipCode: address.zipCode || '',
          country: address.country || ''
        };
      }
    }

    let normalizedSubjects = [];

    if (Array.isArray(subjects)) {
      normalizedSubjects = subjects
        .map(subject => {
          if (typeof subject === 'string') {
            const subjectName = subject.trim();
            if (!subjectName) return null;
            return { name: subjectName, isActive: true };
          }

          if (subject && typeof subject === 'object') {
            return {
              name: subject.name ? String(subject.name).trim() : '',
              subjectId: subject.subjectId || undefined,
              code: subject.code ? String(subject.code).trim().toUpperCase() : '',
              isActive: subject.isActive !== false
            };
          }

          return null;
        })
        .filter(subject => subject && subject.name);
    }

    createdUser = await User.create({
      username: cleanUsername,
      password,
      role: 'teacher',
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : '',
      isActive: true
    });

    let teacher;

    try {
      teacher = await Teacher.create({
        user: createdUser._id,
        employeeId: cleanEmployeeId,
        qualification: qualification || '',
        specialization: specialization || '',
        department: department || 'Other',
        experience:
          experience !== undefined && experience !== null && experience !== ''
            ? Number(experience)
            : 0,
        previousInstitution: previousInstitution || '',
        dateOfBirth: dateOfBirth || null,
        gender: gender || 'Other',
        address: addressObj,
        subjects: normalizedSubjects,
        createdBy: req.user.id
      });
    } catch (teacherError) {
      if (createdUser) {
        await User.findByIdAndDelete(createdUser._id);
      }
      throw teacherError;
    }

    const populatedTeacher = await Teacher.findById(teacher._id)
      .populate('user', '-password')
      .populate('createdBy', 'name');

    return res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: populatedTeacher
    });
  } catch (error) {
    console.error('Create teacher error:', error);

    if (error.code === 11000) {
      const field = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'field';

      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);

      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid value for ${error.path}`
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update teacher
// @route   PUT /api/admin/teachers/:id
// @access  Private (Admin only)
exports.updateTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;

    const {
      name,
      email,
      phone,
      employeeId,
      qualification,
      specialization,
      department,
      experience,
      previousInstitution,
      dateOfBirth,
      gender,
      address,
      subjects,
      isActive
    } = req.body;

    const teacher = await Teacher.findById(teacherId);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    await User.findByIdAndUpdate(teacher.user, {
      name,
      email,
      phone,
      isActive
    });

    let addressObj = {};

    if (address) {
      if (typeof address === 'string') {
        addressObj = { street: address };
      } else {
        addressObj = address;
      }
    }

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      teacherId,
      {
        employeeId: employeeId ? employeeId.toUpperCase() : teacher.employeeId,
        qualification: qualification || teacher.qualification,
        specialization: specialization || teacher.specialization,
        department: department || teacher.department || 'Other',
        experience: experience !== undefined ? experience : teacher.experience,
        previousInstitution: previousInstitution || teacher.previousInstitution,
        dateOfBirth: dateOfBirth || teacher.dateOfBirth,
        gender: gender || teacher.gender || 'Other',
        address: Object.keys(addressObj).length > 0 ? addressObj : teacher.address,
        subjects: subjects || teacher.subjects,
        updatedBy: req.user.id
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('user', '-password');

    res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      data: updatedTeacher
    });
  } catch (error) {
    console.error('Update teacher error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];

      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/admin/teachers/:id
// @access  Private (Admin only)
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    await User.findByIdAndDelete(teacher.user);
    await Teacher.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    console.error('Delete teacher error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset teacher password
// @route   PUT /api/admin/teachers/:id/reset-password
// @access  Private (Admin only)
exports.resetTeacherPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const user = await User.findById(teacher.user);

    user.password = newPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        username: user.username,
        newPassword
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CLASS MANAGEMENT ====================

// @desc    Get all classes
// @route   GET /api/admin/classes
// @access  Private (Admin only)
exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('classTeacher', 'name')
      .sort({ className: 1 });

    res.status(200).json({
      success: true,
      data: classes
    });
  } catch (error) {
    console.error('Get classes error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create class
// @route   POST /api/admin/classes
// @access  Private (Admin only)
exports.createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      classTeacher,
      academicYear,
      subjects,
      roomNumber,
      maxStudents,
      description
    } = req.body;

    const existingClass = await Class.findOne({ className, section });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name and section already exists'
      });
    }

    const newClass = await Class.create({
      className,
      section: section || 'A',
      classTeacher: classTeacher || null,
      academicYear: academicYear || new Date().getFullYear().toString(),
      subjects: subjects || [],
      roomNumber: roomNumber || '',
      maxStudents: maxStudents || 50,
      description: description || '',
      createdBy: req.user.id
    });

    const populatedClass = await Class.findById(newClass._id).populate('classTeacher', 'name');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: populatedClass
    });
  } catch (error) {
    console.error('Create class error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update class
// @route   PUT /api/admin/classes/:id
// @access  Private (Admin only)
exports.updateClass = async (req, res) => {
  try {
    const {
      className,
      section,
      classTeacher,
      academicYear,
      subjects,
      roomNumber,
      maxStudents,
      description,
      isActive
    } = req.body;

    const duplicateClass = await Class.findOne({
      _id: { $ne: req.params.id },
      className,
      section,
      academicYear
    });

    if (duplicateClass) {
      return res.status(400).json({
        success: false,
        message: `Class ${className} - Section ${section} already exists for academic year ${academicYear}`
      });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      {
        className,
        section,
        classTeacher,
        academicYear,
        subjects,
        roomNumber,
        maxStudents,
        description,
        isActive,
        updatedBy: req.user.id
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('classTeacher', 'name');

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Update class error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A class with the same class name, section and academic year already exists.'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete class
// @route   DELETE /api/admin/classes/:id
// @access  Private (Admin only)
exports.deleteClass = async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Delete class error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== EXAM MANAGEMENT ====================

// @desc    Create exam
// @route   POST /api/admin/exams
// @access  Private (Admin only)
exports.createExam = async (req, res) => {
  try {
    const {
      class: className,
      section,
      subject,
      examName,
      examDate,
      academicYear
    } = req.body;

    if (!className || !section || !examName || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Class, section, exam name and subject are required'
      });
    }

    const finalYear = academicYear || new Date().getFullYear().toString();

    let classData = await Class.findOne({
      className,
      section,
      academicYear: finalYear
    });

    if (!classData) {
      classData = await Class.create({
        className,
        section,
        academicYear: finalYear,
        isActive: true
      });
    }

    const subjectDoc = await Subject.findOne({
      name: subject,
      class: className,
      section,
      academicYear: finalYear,
      isActive: true
    });

    let exam = await Result.findOne({
      class: className,
      section,
      examName,
      academicYear: finalYear
    });

    if (exam) {
      const exists = exam.subjects.find(s => s.name === subject);
      if (exists) {
        return res.status(400).json({
          success: false,
          message: `${subject} already added to this exam`
        });
      }

      exam.subjects.push({
        name: subject,
        examDate: examDate ? new Date(examDate) : new Date(),
        marksObtained: 0,
        totalMarks: subjectDoc?.totalMarks || 100,
        grade: '',
        remarks: '',
        teacher: subjectDoc?.teacher || null,
        published: false
      });

      if (examDate && !exam.examDate) {
        exam.examDate = new Date(examDate);
      }

      await exam.save();
    } else {
      exam = await Result.create({
        class: className,
        section,
        examName,
        examDate: examDate ? new Date(examDate) : new Date(),
        academicYear: finalYear,
        subjects: [{
          name: subject,
          examDate: examDate ? new Date(examDate) : new Date(),
          marksObtained: 0,
          totalMarks: subjectDoc?.totalMarks || 100,
          grade: '',
          remarks: '',
          teacher: subjectDoc?.teacher || null,
          published: false
        }]
      });
    }

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update exam
// @route   PUT /api/admin/exams/:id
// @access  Private (Admin only)
exports.updateExam = async (req, res) => {
  try {
    const { examName, examDate, subject } = req.body;

    const exam = await Result.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (examName) exam.examName = examName;
    if (examDate) exam.examDate = examDate;

    if (subject) {
      const sub = exam.subjects.find(s => s.name === subject);
      if (sub && examDate) {
        sub.examDate = examDate;
      }
    }

    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: exam
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Publish result
// @route   PUT /api/admin/exams/:id/publish
// @access  Private (Admin only)
exports.publishResult = async (req, res) => {
  try {
    const exam = await Result.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    exam.published = true;
    exam.publishedBy = req.user.id;
    exam.publishedDate = new Date();
    exam.editDeadline = deadline;

    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Result published successfully',
      data: exam
    });
  } catch (error) {
    console.error('Publish result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all exams
// @route   GET /api/admin/exams
// @access  Private (Admin only)
exports.getExams = async (req, res) => {
  try {
    const { class: className, section, published } = req.query;

    let query = {};

    if (className) query.class = className;
    if (section) query.section = section;

    const exams = await Result.find(query)
      .populate('student', 'rollNumber')
      .sort({ examDate: -1, createdAt: -1 });

    let filtered = exams;

    if (published !== undefined) {
      const wantPublished = published === 'true';
      filtered = exams.filter((exam) => {
        const subjects = exam.subjects || [];
        if (subjects.length === 0) return !wantPublished;
        const allPublished = subjects.every(s => s.published);
        return wantPublished ? allPublished : !allPublished;
      });
    }

    res.status(200).json({
      success: true,
      data: filtered
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete exam
// @route   DELETE /api/admin/exams/:id
// @access  Private (Admin only)
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Result.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    if (exam.published) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a published exam'
      });
    }

    await Result.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    console.error('Delete exam error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== NOTICE MANAGEMENT ====================

// @desc    Create notice
// @route   POST /api/admin/notices
// @access  Private (Admin only)
exports.createNotice = async (req, res) => {
  try {
    const {
      title,
      content,
      targetRoles,
      priority,
      expiresAt,
      attachments,
      isPublic
    } = req.body;

    const notice = await Notice.create({
      title,
      content,
      author: req.user.id,
      targetRoles: (Array.isArray(targetRoles) && targetRoles.length > 0)
        ? targetRoles
        : ['student', 'teacher', 'admin', 'parent'],
      priority: priority || 'Medium',
      expiresAt: expiresAt || null,
      attachments: attachments || [],
      isPublic: isPublic || false,
      isActive: true
    });

    const populatedNotice = await Notice.findById(notice._id)
      .populate('author', 'name');

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: populatedNotice
    });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get all notices
// @route   GET /api/admin/notices
// @access  Private (Admin only)
exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notices
    });
  } catch (error) {
    console.error('Get notices error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update notice
// @route   PUT /api/admin/notices/:id
// @access  Private (Admin only)
exports.updateNotice = async (req, res) => {
  try {
    const {
      title,
      content,
      targetRoles,
      priority,
      expiresAt,
      attachments,
      isActive
    } = req.body;

    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        targetRoles,
        priority,
        expiresAt,
        attachments,
        isActive
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('author', 'name');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully',
      data: notice
    });
  } catch (error) {
    console.error('Update notice error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete notice
// @route   DELETE /api/admin/notices/:id
// @access  Private (Admin only)
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notice deleted successfully'
    });
  } catch (error) {
    console.error('Delete notice error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== SUBJECT MANAGEMENT ====================

// @desc    Get all subjects
// @route   GET /api/admin/subjects
// @access  Private (Admin only)
exports.getSubjects = async (req, res) => {
  try {
    const {
      class: className,
      section,
      teacher,
      academicYear
    } = req.query;

    let query = { isActive: true };

    if (className) query.class = className;
    if (section) query.section = section;
    if (teacher) query.teacher = teacher;
    if (academicYear) query.academicYear = academicYear;

    const subjects = await Subject.find(query)
      .populate('teacher', 'name email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Create subject
// @route   POST /api/admin/subjects
// @access  Private (Admin only)
exports.createSubject = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      class: className,
      section,
      teacher,
      academicYear,
      totalMarks,
      passingMarks,
      theoryMarks,
      practicalMarks
    } = req.body;

    const finalSection = section || 'A';
    const finalYear = academicYear || new Date().getFullYear().toString();

    const existingSubject = await Subject.findOne({
      name,
      class: className,
      section: finalSection,
      academicYear: finalYear
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject already exists in this class/section'
      });
    }

    let classData = await Class.findOne({
      className,
      section: finalSection,
      academicYear: finalYear
    });

    if (!classData) {
      classData = await Class.create({
        className,
        section: finalSection,
        academicYear: finalYear,
        isActive: true,
        createdBy: req.user.id
      });
      console.log(`✅ Auto-created class: ${className}-${finalSection} (${finalYear})`);
    }

    const subject = await Subject.create({
      name,
      code: code ? code.toUpperCase() : '',
      description: description || '',
      class: className,
      section: finalSection,
      teacher: teacher || null,
      academicYear: finalYear,
      totalMarks: totalMarks || 100,
      passingMarks: passingMarks || 33,
      theoryMarks: theoryMarks || 70,
      practicalMarks: practicalMarks || 30,
      createdBy: req.user.id
    });

    await Class.findByIdAndUpdate(
      classData._id,
      {
        $push: {
          subjects: {
            subject: subject._id,
            name: subject.name,
            code: subject.code,
            teacher: teacher || null,
            isActive: true
          }
        }
      }
    );

    const populatedSubject = await Subject.findById(subject._id)
      .populate('teacher', 'name email');

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: populatedSubject
    });
  } catch (error) {
    console.error('Create subject error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update subject
// @route   PUT /api/admin/subjects/:id
// @access  Private (Admin only)
exports.updateSubject = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      class: className,
      section,
      teacher,
      academicYear,
      totalMarks,
      passingMarks,
      theoryMarks,
      practicalMarks,
      isActive
    } = req.body;

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        name,
        code: code ? code.toUpperCase() : undefined,
        description,
        class: className,
        section,
        teacher,
        academicYear,
        totalMarks,
        passingMarks,
        theoryMarks,
        practicalMarks,
        isActive,
        updatedBy: req.user.id
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('teacher', 'name email');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: subject
    });
  } catch (error) {
    console.error('Update subject error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete subject
// @route   DELETE /api/admin/subjects/:id
// @access  Private (Admin only)
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Delete subject error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CLASS - SUBJECT ASSIGNMENT ====================

// @desc    Add subject to class
// @route   POST /api/admin/classes/:id/subjects
// @access  Private (Admin only)
exports.addSubjectToClass = async (req, res) => {
  try {
    const { subjectId } = req.body;

    const classData = await Class.findById(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const exists = classData.subjects.some(
      s => s.subject && s.subject.toString() === subjectId
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Subject already assigned to this class'
      });
    }

    classData.subjects.push({
      subject: subjectId,
      name: subject.name,
      code: subject.code,
      teacher: subject.teacher,
      teacherName: subject.teacherName,
      isActive: true
    });

    await classData.save();

    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name')
      .populate('subjects.subject', 'name code');

    res.status(200).json({
      success: true,
      message: 'Subject added to class successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Add subject to class error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Remove subject from class
// @route   DELETE /api/admin/classes/:id/subjects/:subjectId
// @access  Private (Admin only)
exports.removeSubjectFromClass = async (req, res) => {
  try {
    const { id, subjectId } = req.params;

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    classData.subjects = classData.subjects.filter(
      s => s.subject && s.subject.toString() !== subjectId
    );

    await classData.save();

    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name')
      .populate('subjects.subject', 'name code');

    res.status(200).json({
      success: true,
      message: 'Subject removed from class successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Remove subject from class error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get subject by ID
// @route   GET /api/admin/subjects/:id
// @access  Private (Admin only)
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('teacher', 'name email phone')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: subject
    });
  } catch (error) {
    console.error('Get subject by ID error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Assign teacher to subject
// @route   PUT /api/admin/subjects/:id/assign-teacher
// @access  Private (Admin only)
exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required'
      });
    }

    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      role: 'teacher'
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    subject.teacher = teacher._id;
    subject.teacherName = teacher.name || '';

    subject.updatedBy = req.user.id;

    await subject.save();

    const updatedSubject = await Subject.findById(subject._id)
      .populate('teacher', 'name email phone')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    return res.status(200).json({
      success: true,
      message: 'Teacher assigned successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Assign teacher error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Assign class teacher
// @route   PUT /api/admin/classes/:id/assign-teacher
// @access  Private (Admin only)
exports.assignClassTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

    const classData = await Class.findById(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const teacher = await User.findById(teacherId);

    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    classData.classTeacher = teacherId;
    classData.classTeacherName = teacher.name;

    await classData.save();

    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name code');

    res.status(200).json({
      success: true,
      message: 'Class teacher assigned successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Assign class teacher error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== CLASS STATISTICS ====================

// @desc    Get class statistics
// @route   GET /api/admin/classes/stats
// @access  Private (Admin only)
exports.getClassStats = async (req, res) => {
  try {
    const totalClasses = await Class.countDocuments();
    const activeClasses = await Class.countDocuments({ isActive: true });
    const totalStudents = await Student.countDocuments();

    const classDistribution = await Student.aggregate([
      {
        $group: {
          _id: {
            class: '$class',
            section: '$section'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          class: '$_id.class',
          section: '$_id.section',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: {
          class: 1,
          section: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalClasses,
        activeClasses,
        totalStudents,
        classDistribution
      }
    });
  } catch (error) {
    console.error('Get class stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search classes
// @route   GET /api/admin/classes/search
// @access  Private (Admin only)
exports.searchClasses = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    const classes = await Class.find({
      $or: [
        { className: { $regex: q, $options: 'i' } },
        { section: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    })
      .populate('classTeacher', 'name')
      .limit(20);

    res.status(200).json({
      success: true,
      data: classes
    });
  } catch (error) {
    console.error('Search classes error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ADMIN PROFILE ====================

// @desc    Update admin profile
// @route   PUT /api/admin/profile
// @access  Private (Admin only)
exports.updateAdminProfile = async (req, res) => {
  try {
    const { name, email, phone, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        email,
        phone,
        profilePicture
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update admin profile error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== TIMETABLE MANAGEMENT ====================

// @desc    Get timetable
// @route   GET /api/admin/timetable
// @access  Private (Admin only)
exports.getTimetable = async (req, res) => {
  try {
    const { class: className, section } = req.query;

    let query = {};
    if (className) query.class = className;
    if (section) query.section = section;

    const timetable = await Timetable.find(query)
      .populate('periods.teacher', 'name');

    res.status(200).json({
      success: true,
      data: timetable
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create or update timetable
// @route   POST /api/admin/timetable
// @access  Private (Admin only)
exports.createTimetable = async (req, res) => {
  try {
    const {
      class: className,
      section,
      day,
      periods,
      academicYear
    } = req.body;

    let timetable = await Timetable.findOne({
      class: className,
      section,
      day
    });

    if (timetable) {
      timetable.periods = periods || timetable.periods;
      timetable.academicYear = academicYear || timetable.academicYear;
      timetable.updatedBy = req.user.id;
      await timetable.save();
    } else {
      timetable = await Timetable.create({
        class: className,
        section: section || 'A',
        day,
        periods: periods || [],
        academicYear: academicYear || new Date().getFullYear().toString(),
        createdBy: req.user.id
      });
    }

    const populatedTimetable = await Timetable.findById(timetable._id)
      .populate('periods.teacher', 'name');

    res.status(201).json({
      success: true,
      message: 'Timetable saved successfully',
      data: populatedTimetable
    });
  } catch (error) {
    console.error('Create timetable error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Timetable already exists for this class, section, and day'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete timetable
// @route   DELETE /api/admin/timetable/:id
// @access  Private (Admin only)
exports.deleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndDelete(req.params.id);

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Timetable deleted successfully'
    });
  } catch (error) {
    console.error('Delete timetable error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ATTENDANCE REPORTS ====================

// @desc    Get attendance reports
// @route   GET /api/admin/attendance-reports
// @access  Private (Admin only)
exports.getAttendanceReports = async (req, res) => {
  try {
    const {
      class: className,
      section,
      month,
      year
    } = req.query;

    let query = {};

    if (className) {
      query.class = className;
    }

    if (section) {
      query.section = section;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'rollNumber')
      .populate('user', 'name')
      .sort({ date: -1 });

    const totalRecords = attendance.length;

    const presentRecords = attendance.filter(a => a.status === 'Present').length;
    const absentRecords = attendance.filter(a => a.status === 'Absent').length;
    const lateRecords = attendance.filter(a => a.status === 'Late').length;

    const groupedByDate = attendance.reduce((acc, record) => {
      const date = record.date.toISOString().split('T')[0];

      if (!acc[date]) {
        acc[date] = {
          date,
          present: 0,
          absent: 0,
          late: 0,
          total: 0
        };
      }

      acc[date][record.status.toLowerCase()]++;
      acc[date].total++;

      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        records: attendance,
        summary: {
          totalRecords,
          presentRecords,
          absentRecords,
          lateRecords,
          attendancePercentage:
            totalRecords > 0
              ? ((presentRecords / totalRecords) * 100).toFixed(2)
              : 0
        },
        dailyBreakdown: Object.values(groupedByDate)
      }
    });
  } catch (error) {
    console.error('Get attendance reports error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== PARENT MANAGEMENT ====================

// @desc    Create parent account
// @route   POST /api/admin/parents
// @access  Private (Admin only)
exports.createParent = async (req, res) => {
  try {
    const {
      username,
      password,
      name,
      email,
      phone,
      children,
      occupation,
      relationship,
      address
    } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please use a different email.'
      });
    }

    const user = await User.create({
      username,
      password,
      role: 'parent',
      name,
      email,
      phone: phone || '',
      isActive: true
    });

    const parent = await Parent.create({
      user: user._id,
      children: children || [],
      occupation: occupation || '',
      relationship: relationship || 'Guardian',
      address: address || '',
      createdBy: req.user.id
    });

    const populatedParent = await Parent.findById(parent._id)
      .populate('user', '-password')
      .populate('children', 'rollNumber class section');

    res.status(201).json({
      success: true,
      message: 'Parent account created successfully',
      data: {
        parent: populatedParent,
        credentials: {
          username,
          password,
          role: 'parent'
        }
      }
    });
  } catch (error) {
    console.error('Create parent error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get all parents
// @route   GET /api/admin/parents
// @access  Private (Admin only)
exports.getParents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = {
        $or: [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } },
          { 'user.username': { $regex: search, $options: 'i' } }
        ]
      };
    }

    const parents = await Parent.find(query)
      .populate('user', 'name email phone username profilePicture isActive')
      .populate('children', 'rollNumber class section')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Parent.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        parents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single parent
// @route   GET /api/admin/parents/:id
// @access  Private (Admin only)
exports.getParentById = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .populate('user', '-password')
      .populate('children', 'rollNumber class section');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: parent
    });
  } catch (error) {
    console.error('Get parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update parent
// @route   PUT /api/admin/parents/:id
// @access  Private (Admin only)
exports.updateParent = async (req, res) => {
  try {
    const parentId = req.params.id;
    const {
      name,
      email,
      phone,
      children,
      occupation,
      relationship,
      address,
      isActive
    } = req.body;

    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    await User.findByIdAndUpdate(parent.user, {
      name,
      email,
      phone,
      isActive
    });

    const updatedParent = await Parent.findByIdAndUpdate(
      parentId,
      {
        children: children || [],
        occupation: occupation || '',
        relationship: relationship || 'Guardian',
        address: address || ''
      },
      { returnDocument: 'after', runValidators: true }
    ).populate('user', '-password')
      .populate('children', 'rollNumber class section');

    res.status(200).json({
      success: true,
      message: 'Parent updated successfully',
      data: updatedParent
    });
  } catch (error) {
    console.error('Update parent error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete parent
// @route   DELETE /api/admin/parents/:id
// @access  Private (Admin only)
exports.deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    await User.findByIdAndDelete(parent.user);
    await Parent.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Parent deleted successfully'
    });
  } catch (error) {
    console.error('Delete parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset parent password
// @route   PUT /api/admin/parents/:id/reset-password
// @access  Private (Admin only)
exports.resetParentPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const parent = await Parent.findById(req.params.id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const user = await User.findById(parent.user);
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        username: user.username,
        newPassword
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};