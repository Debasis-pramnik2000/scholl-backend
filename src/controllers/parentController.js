const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const User = require('../models/User');
const Notice = require('../models/Notice');

// @desc    Parent Dashboard
// @route   GET /api/parent/dashboard
// @access  Private (Parent only)
exports.getParentDashboard = async (req, res) => {
  try {
    const parent = await Parent.findOne({ user: req.user.id })
      .populate('children', 'rollNumber class section')
      .populate({
        path: 'children',
        populate: { path: 'user', select: 'name email profilePicture' }
      });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found'
      });
    }

    // Get children data
    const childrenData = await Promise.all(parent.children.map(async (child) => {
      // Get attendance summary for current month
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const attendance = await Attendance.find({
        student: child._id,
        date: { $gte: startOfMonth }
      });

      const present = attendance.filter(a => a.status === 'Present').length;
      const total = attendance.length;

      // Get latest results
      const results = await Result.find({ student: child._id })
        .sort({ examDate: -1 })
        .limit(2);

      return {
        ...child.toObject(),
        attendance: {
          present,
          total,
          percentage: total > 0 ? ((present / total) * 100).toFixed(2) : 0
        },
        latestResults: results
      };
    }));

    // Get notices for parents
    const notices = await Notice.find({
      targetRoles: 'parent',
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
    .populate('author', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

    res.status(200).json({
      success: true,
      data: {
        parent,
        children: childrenData,
        notices,
        totalChildren: parent.children.length
      }
    });
  } catch (error) {
    console.error('Parent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get child attendance
// @route   GET /api/parent/attendance/:childId
// @access  Private (Parent only)
exports.getChildAttendance = async (req, res) => {
  try {
    const { childId } = req.params;
    const { month, year } = req.query;

    const parent = await Parent.findOne({ user: req.user.id });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check if child belongs to parent
    if (!parent.children.includes(childId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this child\'s attendance'
      });
    }

    const student = await Student.findById(childId).populate('user', 'name');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    let query = { student: childId };
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 });

    const present = attendance.filter(a => a.status === 'Present').length;
    const absent = attendance.filter(a => a.status === 'Absent').length;
    const late = attendance.filter(a => a.status === 'Late').length;

    res.status(200).json({
      success: true,
      data: {
        student,
        attendance,
        summary: {
          present,
          absent,
          late,
          total: attendance.length,
          percentage: attendance.length > 0 
            ? ((present / attendance.length) * 100).toFixed(2) 
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get child attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get child results
// @route   GET /api/parent/results/:childId
// @access  Private (Parent only)
exports.getChildResults = async (req, res) => {
  try {
    const { childId } = req.params;

    const parent = await Parent.findOne({ user: req.user.id });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    if (!parent.children.includes(childId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this child\'s results'
      });
    }

    const student = await Student.findById(childId).populate('user', 'name');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const results = await Result.find({ student: childId })
      .sort({ examDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        student,
        results
      }
    });
  } catch (error) {
    console.error('Get child results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update parent profile
// @route   PUT /api/parent/profile
// @access  Private (Parent only)
exports.updateParentProfile = async (req, res) => {
  try {
    const { occupation, relationship, address } = req.body;

    const parent = await Parent.findOneAndUpdate(
      { user: req.user.id },
      { occupation, relationship, address },
     { returnDocument: "after", runValidators: true }
    ).populate('children', 'rollNumber class section');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: parent
    });
  } catch (error) {
    console.error('Update parent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};