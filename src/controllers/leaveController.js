const Leave = require('../models/Leave');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const User = require('../models/User');

const MAX_LEAVES_PER_MONTH = 4;

// @desc    Apply for leave
// @route   POST /api/leave/apply
// @access  Private (Student/Teacher)
exports.applyLeave = async (req, res) => {
  try {
    const {
      leaveType,
      reason,
      fromDate,
      toDate,
      remarks,
      attachments
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check leave limit for current month
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    
    const canApply = await Leave.canApplyForLeave(req.user.id, month, year, MAX_LEAVES_PER_MONTH);
    if (!canApply) {
      return res.status(400).json({
        success: false,
        message: `You can only apply for ${MAX_LEAVES_PER_MONTH} leaves per month. You have already used all leaves.`
      });
    }

    // Get student/teacher details
    let studentData = null;
    let teacherData = null;
    let classInfo = '';
    let sectionInfo = '';

    if (user.role === 'student') {
      studentData = await Student.findOne({ user: req.user.id });
      if (!studentData) {
        return res.status(404).json({
          success: false,
          message: 'Student profile not found'
        });
      }
      classInfo = studentData.class;
      sectionInfo = studentData.section;
    } else if (user.role === 'teacher') {
      teacherData = await Teacher.findOne({ user: req.user.id });
      if (!teacherData) {
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found'
        });
      }
    }

    // Create leave application
    const leave = await Leave.create({
      user: req.user.id,
      role: user.role,
      studentId: studentData?._id || null,
      teacherId: teacherData?._id || null,
      class: classInfo,
      section: sectionInfo,
      leaveType,
      reason,
      fromDate,
      toDate,
      remarks: remarks || '',
      attachments: attachments || [],
      status: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: leave
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get user's leaves
// @route   GET /api/leave/my-leaves
// @access  Private (Student/Teacher)
exports.getMyLeaves = async (req, res) => {
  try {
    const { status, month, year } = req.query;

    let query = { user: req.user.id };
    if (status) query.status = status;
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.fromDate = { $gte: startDate };
      query.toDate = { $lte: endDate };
    }

    const leaves = await Leave.find(query)
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    // Get leave statistics
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    const usedLeaves = await Leave.getLeaveCount(req.user.id, currentMonth, currentYear);
    const availableLeaves = MAX_LEAVES_PER_MONTH - usedLeaves;

    res.status(200).json({
      success: true,
      data: {
        leaves,
        statistics: {
          used: usedLeaves,
          available: availableLeaves,
          maxLeaves: MAX_LEAVES_PER_MONTH,
          pending: leaves.filter(l => l.status === 'Pending').length,
          approved: leaves.filter(l => l.status === 'Approved').length,
          rejected: leaves.filter(l => l.status === 'Rejected').length
        }
      }
    });
  } catch (error) {
    console.error('Get my leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all leaves for admin
// @route   GET /api/admin/leaves
// @access  Private (Admin only)
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, role, month, year } = req.query;

    let query = {};
    if (status) query.status = status;
    if (role) query.role = role;
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.fromDate = { $gte: startDate };
      query.toDate = { $lte: endDate };
    }

    const leaves = await Leave.find(query)
      .populate('user', 'name email role')
      .populate('approvedBy', 'name')
      .populate('studentId', 'rollNumber class section')
      .populate('teacherId', 'employeeId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Approve/Reject leave
// @route   PUT /api/admin/leaves/:id
// @access  Private (Admin only)
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const leaveId = req.params.id;

    if (!['Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    // Check leave limit for approval
    if (status === 'Approved') {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      
      // Check if user has already used all leaves
      const usedLeaves = await Leave.getLeaveCount(leave.user, month, year);
      if (usedLeaves + leave.totalDays > MAX_LEAVES_PER_MONTH) {
        return res.status(400).json({
          success: false,
          message: `This user has already used ${usedLeaves} leaves. Max ${MAX_LEAVES_PER_MONTH} leaves allowed per month.`
        });
      }
    }

    leave.status = status;
    leave.approvedBy = req.user.id;
    leave.approvedDate = new Date();
    if (remarks) leave.remarks = remarks;
    await leave.save();

    const populatedLeave = await Leave.findById(leaveId)
      .populate('user', 'name email')
      .populate('approvedBy', 'name');

    res.status(200).json({
      success: true,
      message: `Leave ${status.toLowerCase()} successfully`,
      data: populatedLeave
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get leave reports
// @route   GET /api/admin/leaves/reports
// @access  Private (Admin only)
exports.getLeaveReports = async (req, res) => {
  try {
    const { month, year, role } = req.query;

    let query = { status: 'Approved' };
    if (role) query.role = role;
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.fromDate = { $gte: startDate };
      query.toDate = { $lte: endDate };
    }

    const leaves = await Leave.find(query)
      .populate('user', 'name email role')
      .populate('studentId', 'rollNumber class section');

    // Group by role
    const studentLeaves = leaves.filter(l => l.role === 'student');
    const teacherLeaves = leaves.filter(l => l.role === 'teacher');

    // Calculate total days
    const totalStudentDays = studentLeaves.reduce((sum, l) => sum + (l.totalDays || 0), 0);
    const totalTeacherDays = teacherLeaves.reduce((sum, l) => sum + (l.totalDays || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalLeaves: leaves.length,
          studentLeaves: studentLeaves.length,
          teacherLeaves: teacherLeaves.length,
          totalStudentDays,
          totalTeacherDays,
          averageStudentDays: studentLeaves.length > 0 ? (totalStudentDays / studentLeaves.length).toFixed(2) : 0,
          averageTeacherDays: teacherLeaves.length > 0 ? (totalTeacherDays / teacherLeaves.length).toFixed(2) : 0
        },
        studentLeaves,
        teacherLeaves,
        allLeaves: leaves
      }
    });
  } catch (error) {
    console.error('Get leave reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};