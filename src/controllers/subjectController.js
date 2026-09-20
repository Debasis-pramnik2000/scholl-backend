const Subject = require('../models/Subject');
const User = require('../models/User');

// @desc    Create a new subject
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

    // Check if subject already exists
    const exists = await Subject.isSubjectExists(
      code,
      className,
      section,
      academicYear
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists in this class/section'
      });
    }

    // Check if teacher exists
    if (teacher) {
      const teacherExists = await User.findOne({ 
        _id: teacher, 
        role: 'teacher' 
      });
      if (!teacherExists) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found'
        });
      }
    }

    const subject = await Subject.create({
      name,
      code: code.toUpperCase(),
      description,
      class: className,
      section: section || 'A',
      teacher,
      academicYear,
      totalMarks: totalMarks || 100,
      passingMarks: passingMarks || 33,
      theoryMarks: theoryMarks || 70,
      practicalMarks: practicalMarks || 30,
      createdBy: req.user.id
    });

    const populatedSubject = await Subject.findById(subject._id)
      .populate('teacher', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: populatedSubject
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get all subjects with filters
// @route   GET /api/admin/subjects
// @access  Private (Admin only)
exports.getSubjects = async (req, res) => {
  try {
    const { 
      class: className, 
      section, 
      teacher, 
      isActive,
      academicYear,
      search 
    } = req.query;

    let query = {};

    if (className) query.class = className;
    if (section) query.section = section;
    if (teacher) query.teacher = teacher;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (academicYear) query.academicYear = academicYear;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const subjects = await Subject.find(query)
      .populate('teacher', 'name email phone')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ class: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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

    res.status(200).json({
      success: true,
      data: subject
    });
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if teacher exists
    if (teacher) {
      const teacherExists = await User.findOne({ 
        _id: teacher, 
        role: 'teacher' 
      });
      if (!teacherExists) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found'
        });
      }
    }

    // Check for duplicate subject
    if (code && code.toUpperCase() !== subject.code) {
      const exists = await Subject.findOne({
        code: code.toUpperCase(),
        class: className || subject.class,
        section: section || subject.section,
        academicYear: academicYear || subject.academicYear,
        _id: { $ne: req.params.id }
      });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Subject with this code already exists in this class/section'
        });
      }
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        name: name || subject.name,
        code: code ? code.toUpperCase() : subject.code,
        description: description || subject.description,
        class: className || subject.class,
        section: section || subject.section,
        teacher: teacher || subject.teacher,
        academicYear: academicYear || subject.academicYear,
        totalMarks: totalMarks || subject.totalMarks,
        passingMarks: passingMarks || subject.passingMarks,
        theoryMarks: theoryMarks || subject.theoryMarks,
        practicalMarks: practicalMarks || subject.practicalMarks,
        isActive: isActive !== undefined ? isActive : subject.isActive,
        updatedBy: req.user.id
      },
      { returnDocument: "after", runValidators: true }
    ).populate('teacher', 'name email phone');

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Update subject error:', error);
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

// @desc    Assign teacher to subject
// @route   PUT /api/admin/subjects/:id/assign-teacher
// @access  Private (Admin only)
exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    subject.teacher = teacherId;
    subject.teacherName = teacher.name;
    await subject.save();

    const updatedSubject = await Subject.findById(subject._id)
      .populate('teacher', 'name email phone');

    res.status(200).json({
      success: true,
      message: 'Teacher assigned successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Assign teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get subjects by class (for teachers)
// @route   GET /api/teacher/subjects
// @access  Private (Teacher only)
exports.getTeacherSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({
      teacher: req.user.id,
      isActive: true
    })
    .select('name code class section description')
    .sort({ class: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('Get teacher subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get subjects for student
// @route   GET /api/student/subjects
// @access  Private (Student only)
exports.getStudentSubjects = async (req, res) => {
  try {
    // Get student's class and section from student model
    const Student = require('../models/Student');
    const student = await Student.findOne({ user: req.user.id });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const subjects = await Subject.find({
      class: student.class,
      section: student.section,
      isActive: true
    })
    .populate('teacher', 'name')
    .select('name code description teacherName totalMarks')
    .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('Get student subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};