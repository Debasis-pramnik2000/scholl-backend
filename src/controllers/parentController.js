const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const User = require('../models/User');
const Notice = require('../models/Notice');
const PDFDocument = require('pdfkit');

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

// @desc    Get parent notices
// @route   GET /api/parent/notices
// @access  Private (Parent only)
exports.getParentNotices = async (req, res) => {
  try {
    const notices = await Notice.find({
      $and: [
        {
          $or: [
            { targetRoles: 'parent' },
            { targetRoles: { $exists: false } },
            { targetRoles: { $size: 0 } },
            { targetRoles: 'all' }
          ]
        },
        {
          $or: [
            { isActive: true },
            { isActive: { $exists: false } }
          ]
        },
        {
          $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: { $exists: false } },
            { expiresAt: null }
          ]
        }
      ]
    })
    .populate('author', 'name')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notices
    });
  } catch (error) {
    console.error('Get parent notices error:', error);
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

// @desc    Download child report card (PDF)
// @route   GET /api/parent/report-card/:childId
// @access  Private (Parent only)
// @desc    Download child report card (PDF)
// @route   GET /api/parent/report-card/:childId
// @access  Private (Parent only)
// @desc    Download child report card (PDF)
// @route   GET /api/parent/report-card/:childId
// @access  Private (Parent only)
exports.getChildReportCard = async (req, res) => {
  try {
    const { childId } = req.params;

    const parent = await Parent.findOne({ user: req.user.id });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const student = await Student.findById(childId).populate('user', 'name email');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

const results = await Result.find({ student: childId }).sort({ examDate: -1 });
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-card-${student.rollNumber}.pdf"`
    );
    doc.pipe(res);

    const left = 50;
    const right = 545;

    const drawStudentHeader = () => {
      doc.font('Helvetica-Bold').fontSize(20).fillColor('black')
        .text('REPORT CARD', left, 50, { width: right - left, align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(11)
        .text('School Management System', left, doc.y, { width: right - left, align: 'center' });
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(12).text('Student Information', left, doc.y);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(11);
      doc.text(`Name: ${student.user?.name || 'N/A'}`, left, doc.y);
      doc.text(`Roll Number: ${student.rollNumber || 'N/A'}`, left, doc.y);
      doc.text(`Class: ${student.class || 'N/A'} - Section: ${student.section || 'N/A'}`, left, doc.y);
      doc.text(`Email: ${student.user?.email || 'N/A'}`, left, doc.y);
      doc.moveDown(1);
    };

    drawStudentHeader();

    if (results.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(12)
        .text('No published results available.', left, doc.y);
      doc.end();
      return;
    }

    results.forEach((result, index) => {
      if (index > 0) {
        doc.addPage();
        drawStudentHeader();
      }

      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0d6efd')
        .text(`Exam: ${result.examName || 'N/A'}`, left, doc.y);
      doc.fillColor('black').font('Helvetica').fontSize(11);
      doc.text(`Date: ${result.examDate ? new Date(result.examDate).toLocaleDateString() : 'N/A'}`, left, doc.y);
      doc.text(`Academic Year: ${result.academicYear || 'N/A'}`, left, doc.y);
      doc.moveDown(0.5);

      // Table header
      let y = doc.y;
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Subject', left, y, { width: 200 });
      doc.text('Marks', 250, y, { width: 80 });
      doc.text('Total', 330, y, { width: 80 });
      doc.text('Grade', 410, y, { width: 80 });
      y += 16;
      doc.moveTo(left, y).lineTo(right, y).stroke();
      y += 6;

      doc.font('Helvetica').fontSize(10);
      const subjects = result.subjects || [];
      if (subjects.length === 0) {
        doc.text('No subjects', left, y);
        y += 16;
      } else {
        subjects.forEach((sub) => {
          doc.text(sub.name || '-', left, y, { width: 200 });
          doc.text(String(sub.marksObtained ?? '-'), 250, y, { width: 80 });
          doc.text(String(sub.totalMarks ?? '-'), 330, y, { width: 80 });
          doc.text(sub.grade || '-', 410, y, { width: 80 });
          y += 16;
        });
      }

      doc.moveTo(left, y).lineTo(right, y).stroke();
      y += 10;

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text(`Total Marks: ${result.totalMarks ?? '-'}`, left, y); y += 16;
      doc.text(`Percentage: ${result.percentage ?? '-'}%`, left, y); y += 16;
      doc.text(`Overall Grade: ${result.grade || '-'}`, left, y); y += 16;
      if (result.rank) {
        doc.text(`Rank: ${result.rank}`, left, y); y += 16;
      }

      doc.y = y;
    });

    doc.end();
  } catch (error) {
    console.error('Report card error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
};