const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const Result = require('../models/Result');
const Notice = require('../models/Notice');

// @desc    Get student dashboard data
// @route   GET /api/student/dashboard
// @access  Private (Student only)
exports.getDashboard = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.findOne({
      student: student._id,
      date: { $gte: today }
    });

    // Get attendance summary for current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const attendanceRecords = await Attendance.find({
      student: student._id,
      date: { $gte: startOfMonth }
    });

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'Present').length;
    const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // Get upcoming timetable
    const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
    const timetable = await Timetable.findOne({
      class: student.class,
      section: student.section,
      day: todayName
    });

    // Get recent notices
    const notices = await Notice.find({
      targetRoles: 'student',
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('author', 'name');

    // Get upcoming exams
    const exams = await Result.find({
      student: student._id,
      published: false
    })
    .sort({ examDate: 1 })
    .limit(5);

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: req.user.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section
        },
        attendance: {
          today: todayAttendance ? todayAttendance.status : 'Not Marked',
          totalDays,
          presentDays,
          attendancePercentage: attendancePercentage.toFixed(2)
        },
        timetable: timetable || null,
        notices,
        upcomingExams: exams
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark attendance
// @route   POST /api/student/attendance
// @access  Private (Student only)
exports.markAttendance = async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    // Check if student exists
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    // Check if already marked attendance today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingAttendance = await Attendance.findOne({
      student: student._id,
      date: { $gte: today }
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    // Check location (1km = 1000 meters)
    const instituteLat = parseFloat(process.env.INSTITUTE_LATITUDE);
    const instituteLng = parseFloat(process.env.INSTITUTE_LONGITUDE);
    
    // Haversine formula to calculate distance
    const distance = getDistanceFromLatLonInKm(
      latitude,
      longitude,
      instituteLat,
      instituteLng
    );

    if (distance > 1) {
      return res.status(400).json({
        success: false,
        message: `You must be within 1km of the institute to mark attendance. Current distance: ${distance.toFixed(2)}km`
      });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      student: student._id,
      user: req.user.id,
      class: student.class,
      section: student.section,
      status: 'Present',
      location: {
        latitude,
        longitude,
        accuracy
      },
      markedBy: req.user.id,
      checkInTime: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get attendance history
// @route   GET /api/student/attendance
// @access  Private (Student only)
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    let query = { student: student._id };
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 });

    // Calculate statistics
    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'Present').length;
    const absentDays = attendance.filter(a => a.status === 'Absent').length;
    const lateDays = attendance.filter(a => a.status === 'Late').length;

    res.status(200).json({
      success: true,
      data: {
        records: attendance,
        statistics: {
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          attendancePercentage: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get timetable
// @route   GET /api/student/timetable
// @access  Private (Student only)
exports.getTimetable = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const timetable = await Timetable.find({
      class: student.class,
      section: student.section
    }).populate('periods.teacher', 'name');

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

// @desc    Get results
// @route   GET /api/student/results
// @access  Private (Student only)
exports.getResults = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const results = await Result.find({
      student: student._id,
      published: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
// @desc    Get study materials for student
// @route   GET /api/student/materials
// @access  Private (Student only)
exports.getStudentMaterials = async (req, res) => {
  try {
    const Student = require('../models/Student');
    const StudyMaterial = require('../models/StudyMaterial');
    
    // Get student's class and section
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get materials for student's class and section
    const materials = await StudyMaterial.find({
      class: student.class,
      section: student.section,
      isActive: true
    })
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: materials
    });
  } catch (error) {
    console.error('Get student materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
// @desc    Get exam schedule
// @route   GET /api/student/exams
// @access  Private (Student only)
exports.getExamSchedule = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const exams = await Result.find({
      student: student._id,
      published: false
    }).sort({ examDate: 1 });

    res.status(200).json({
      success: true,
      data: exams
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get notices
// @route   GET /api/student/notices
// @access  Private (Student only)
exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({
      targetRoles: 'student',
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
    .sort({ priority: -1, createdAt: -1 })
    .populate('author', 'name');

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

// Helper function: Calculate distance between two coordinates
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
