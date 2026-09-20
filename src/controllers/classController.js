const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Student = require('../models/Student');

// @desc    Create a new class
// @route   POST /api/admin/classes
// @access  Private (Admin only)
exports.createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      classTeacher,
      academicYear,
      roomNumber,
      maxStudents,
      description
    } = req.body;

    // Check if class already exists
    const existingClass = await Class.findOne({
      className,
      section,
      academicYear
    });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name, section and academic year already exists'
      });
    }

    // Check if teacher exists and is a teacher
    if (classTeacher) {
      const teacher = await User.findOne({
        _id: classTeacher,
        role: 'teacher'
      });
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found or not a teacher'
        });
      }
    }

    const newClass = await Class.create({
      className,
      section: section || 'A',
      classTeacher: classTeacher || null,
      academicYear: academicYear || new Date().getFullYear().toString(),
      roomNumber,
      maxStudents: maxStudents || 50,
      description,
      createdBy: req.user.id
    });

    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'name code');

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

// @desc    Get all classes with filters
// @route   GET /api/admin/classes
// @access  Private (Admin only)
exports.getClasses = async (req, res) => {
  try {
    const {
      academicYear,
      classTeacher,
      isActive,
      search
    } = req.query;

    let query = {};

    if (academicYear) query.academicYear = academicYear;
    if (classTeacher) query.classTeacher = classTeacher;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    if (search) {
      query.$or = [
        { className: { $regex: search, $options: 'i' } },
        { section: { $regex: search, $options: 'i' } },
        { classTeacherName: { $regex: search, $options: 'i' } }
      ];
    }

    const classes = await Class.find(query)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'name code description')
      .populate('subjects.teacher', 'name')
      .sort({ className: 1, section: 1 });

    res.status(200).json({
      success: true,
      count: classes.length,
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

// @desc    Get single class by ID
// @route   GET /api/admin/classes/:id
// @access  Private (Admin only)
exports.getClassById = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'name code description')
      .populate('subjects.teacher', 'name')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Get students in this class
    const students = await Student.find({
      class: classData.className,
      section: classData.section
    })
    .populate('user', 'name email phone profilePicture')
    .sort({ rollNumber: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...classData.toObject(),
        students
      }
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
      roomNumber,
      maxStudents,
      description,
      isActive
    } = req.body;

    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if teacher exists and is a teacher
    if (classTeacher) {
      const teacher = await User.findOne({
        _id: classTeacher,
        role: 'teacher'
      });
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found or not a teacher'
        });
      }
    }

    // Check for duplicate class
    if (className && className !== classData.className || 
        section && section !== classData.section ||
        academicYear && academicYear !== classData.academicYear) {
      const exists = await Class.findOne({
        className: className || classData.className,
        section: section || classData.section,
        academicYear: academicYear || classData.academicYear,
        _id: { $ne: req.params.id }
      });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Class with this name, section and academic year already exists'
        });
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      {
        className: className || classData.className,
        section: section || classData.section,
        classTeacher: classTeacher || classData.classTeacher,
        academicYear: academicYear || classData.academicYear,
        roomNumber: roomNumber || classData.roomNumber,
        maxStudents: maxStudents || classData.maxStudents,
        description: description || classData.description,
        isActive: isActive !== undefined ? isActive : classData.isActive,
        updatedBy: req.user.id
      },
      { returnDocument: "after", runValidators: true }
    )
    .populate('classTeacher', 'name email phone')
    .populate('subjects.subject', 'name code');

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Update class error:', error);
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

    // Check if subject already assigned
    const exists = classData.subjects.some(s => 
      s.subject && s.subject.toString() === subjectId.toString()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Subject already assigned to this class'
      });
    }

    await classData.addSubject(subjectId);
    
    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name code description')
      .populate('subjects.teacher', 'name');

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

    await classData.removeSubject(subjectId);
    
    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name email')
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

    await classData.assignTeacher(teacherId);
    
    const updatedClass = await Class.findById(classData._id)
      .populate('classTeacher', 'name email phone')
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

// @desc    Get class statistics
// @route   GET /api/admin/classes/stats
// @access  Private (Admin only)
exports.getClassStats = async (req, res) => {
  try {
    const stats = await Class.getClassStats();
    
    const totalClasses = await Class.countDocuments();
    const activeClasses = await Class.countDocuments({ isActive: true });
    const totalStudents = await Student.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalClasses,
        activeClasses,
        totalStudents,
        yearlyStats: stats
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

    const classes = await Class.searchClasses(q);

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