const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');

// ==================== GET TIMETABLE ====================

// @desc    Get all timetables with filters
// @route   GET /api/admin/timetable
// @access  Private (Admin only)
exports.getTimetables = async (req, res) => {
  try {
    const { class: className, section, day, academicYear } = req.query;

    let query = { isActive: true };
    if (className) query.class = className;
    if (section) query.section = section;
    if (day) query.day = day;
    if (academicYear) query.academicYear = academicYear;

    const timetables = await Timetable.find(query)
      .populate('periods.teacher', 'name email')
      .populate('createdBy', 'name')
      .sort({ class: 1, section: 1, day: 1 });

    res.status(200).json({
      success: true,
      count: timetables.length,
      data: timetables
    });
  } catch (error) {
    console.error('Get timetables error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single timetable by ID
// @route   GET /api/admin/timetable/:id
// @access  Private (Admin only)
exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('periods.teacher', 'name email');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

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

// @desc    Get timetable by class
// @route   GET /api/admin/timetable/class/:className/:section
// @access  Private (Admin only)
exports.getTimetableByClass = async (req, res) => {
  try {
    const { className, section } = req.params;
    const { day } = req.query;

    const timetables = await Timetable.getTimetableByClass(className, section, day);

    res.status(200).json({
      success: true,
      data: timetables
    });
  } catch (error) {
    console.error('Get timetable by class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get timetable by teacher
// @route   GET /api/teacher/timetable
// @access  Private (Teacher only)
exports.getTeacherTimetable = async (req, res) => {
  try {
    const { day } = req.query;
    const timetables = await Timetable.getTimetableByTeacher(req.user.id, day);

    res.status(200).json({
      success: true,
      data: timetables
    });
  } catch (error) {
    console.error('Get teacher timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get student timetable
// @route   GET /api/student/timetable
// @access  Private (Student only)
exports.getStudentTimetable = async (req, res) => {
  try {
    const Student = require('../models/Student');
    const student = await Student.findOne({ user: req.user.id });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const timetables = await Timetable.getTimetableByClass(
      student.class,
      student.section
    );

    res.status(200).json({
      success: true,
      data: timetables
    });
  } catch (error) {
    console.error('Get student timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CREATE TIMETABLE ====================

// @desc    Create new timetable
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

    // ✅ Check if class exists
    const classExists = await Class.findOne({ 
      className, 
      section: section || 'A' 
    });
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // ✅ Check if timetable already exists for this class, section, day
    const existingTimetable = await Timetable.findOne({
      class: className,
      section: section || 'A',
      day,
      academicYear: academicYear || new Date().getFullYear().toString()
    });

    if (existingTimetable) {
      return res.status(400).json({
        success: false,
        message: `Timetable already exists for ${className}-${section} on ${day}`
      });
    }

    // ✅ Validate periods
    if (!periods || periods.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one period is required'
      });
    }

    // ✅ Check for duplicate period numbers
    const periodNumbers = periods.map(p => p.periodNumber);
    const uniquePeriods = new Set(periodNumbers);
    if (periodNumbers.length !== uniquePeriods.size) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate period numbers found'
      });
    }

    // ✅ Validate teacher exists
    for (let period of periods) {
      if (period.teacher) {
        const teacher = await User.findOne({ 
          _id: period.teacher,
          role: 'teacher' 
        });
        if (!teacher) {
          return res.status(404).json({
            success: false,
            message: `Teacher not found for period ${period.periodNumber}`
          });
        }
      }
    }

    // ✅ Create timetable
    const timetable = await Timetable.create({
      class: className,
      section: section || 'A',
      day,
      periods,
      academicYear: academicYear || new Date().getFullYear().toString(),
      createdBy: req.user.id
    });

    const populatedTimetable = await Timetable.findById(timetable._id)
      .populate('periods.teacher', 'name email');

    res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
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

// ==================== UPDATE TIMETABLE ====================

// @desc    Update timetable
// @route   PUT /api/admin/timetable/:id
// @access  Private (Admin only)
exports.updateTimetable = async (req, res) => {
  try {
    const { periods, academicYear, isActive } = req.body;

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    // ✅ Validate periods if provided
    if (periods) {
      // Check for duplicate period numbers
      const periodNumbers = periods.map(p => p.periodNumber);
      const uniquePeriods = new Set(periodNumbers);
      if (periodNumbers.length !== uniquePeriods.size) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate period numbers found'
        });
      }

      // Validate teacher exists
      for (let period of periods) {
        if (period.teacher) {
          const teacher = await User.findOne({ 
            _id: period.teacher,
            role: 'teacher' 
          });
          if (!teacher) {
            return res.status(404).json({
              success: false,
              message: `Teacher not found for period ${period.periodNumber}`
            });
          }
        }
      }

      timetable.periods = periods;
    }

    if (academicYear) timetable.academicYear = academicYear;
    if (isActive !== undefined) timetable.isActive = isActive;
    timetable.updatedBy = req.user.id;

    await timetable.save();

    const populatedTimetable = await Timetable.findById(timetable._id)
      .populate('periods.teacher', 'name email');

    res.status(200).json({
      success: true,
      message: 'Timetable updated successfully',
      data: populatedTimetable
    });
  } catch (error) {
    console.error('Update timetable error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== DELETE TIMETABLE ====================

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

// ==================== COPY TIMETABLE ====================

// @desc    Copy timetable from one class to another
// @route   POST /api/admin/timetable/copy
// @access  Private (Admin only)
exports.copyTimetable = async (req, res) => {
  try {
    const {
      fromClass,
      fromSection,
      toClass,
      toSection,
      academicYear
    } = req.body;

    // ✅ Get source timetable
    const sourceTimetables = await Timetable.find({
      class: fromClass,
      section: fromSection
    });

    if (sourceTimetables.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No timetable found for source class'
      });
    }

    // ✅ Check if target already has timetables
    const existingTimetables = await Timetable.find({
      class: toClass,
      section: toSection
    });

    if (existingTimetables.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Target class already has timetables'
      });
    }

    // ✅ Copy timetables
    const copiedTimetables = [];
    for (let source of sourceTimetables) {
      const newTimetable = await Timetable.create({
        class: toClass,
        section: toSection,
        day: source.day,
        periods: source.periods.map(p => ({
          periodNumber: p.periodNumber,
          subject: p.subject,
          subjectCode: p.subjectCode,
          teacher: p.teacher,
          teacherName: p.teacherName,
          startTime: p.startTime,
          endTime: p.endTime,
          room: p.room,
          isActive: true
        })),
        academicYear: academicYear || source.academicYear,
        createdBy: req.user.id
      });
      copiedTimetables.push(newTimetable);
    }

    res.status(201).json({
      success: true,
      message: 'Timetable copied successfully',
      data: copiedTimetables
    });
  } catch (error) {
    console.error('Copy timetable error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== TIMETABLE REPORT ====================

// @desc    Get timetable report
// @route   GET /api/admin/timetable/report
// @access  Private (Admin only)
exports.getTimetableReport = async (req, res) => {
  try {
    const { class: className, section } = req.query;

    let query = { isActive: true };
    if (className) query.class = className;
    if (section) query.section = section;

    const timetables = await Timetable.find(query)
      .populate('periods.teacher', 'name')
      .sort({ class: 1, section: 1, day: 1 });

    // ✅ Group by class
    const groupedByClass = timetables.reduce((acc, item) => {
      const key = `${item.class}-${item.section}`;
      if (!acc[key]) {
        acc[key] = {
          class: item.class,
          section: item.section,
          timetables: []
        };
      }
      acc[key].timetables.push(item);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        total: timetables.length,
        groupedByClass: Object.values(groupedByClass),
        timetables
      }
    });
  } catch (error) {
    console.error('Get timetable report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};