const Admission = require('../models/Admission');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const fs = require('fs');
const path = require('path');

// ==================== PUBLIC ROUTES ====================

// @desc    Submit admission application
// @route   POST /api/admission/apply
// @access  Public
exports.submitApplication = async (req, res) => {
  try {
    const {
      studentName,
      fatherName,
      motherName,
      dateOfBirth,
      age,
      gender,
      mobile,
      alternateMobile,
      aadhaarNumber,
      address,
      applyingForClass,
      section,
      lastQualification,
      previousSchool,
      lastClassPassed,
      percentage,
      yearOfPassing
    } = req.body;

    // ✅ Validate required fields
    if (!studentName || !fatherName || !dateOfBirth || !gender || 
        !mobile || !aadhaarNumber || !applyingForClass) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    // ✅ Check duplicate mobile
    const existingMobile = await Admission.checkDuplicateMobile(mobile);
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: `An application already exists with this mobile number. Application No: ${existingMobile.applicationNumber}`
      });
    }

    // ✅ Check duplicate Aadhaar
    const existingAadhaar = await Admission.checkDuplicateAadhaar(aadhaarNumber);
    if (existingAadhaar) {
      return res.status(400).json({
        success: false,
        message: `An application already exists with this Aadhaar number. Application No: ${existingAadhaar.applicationNumber}`
      });
    }

    // ✅ Check if files are uploaded
    const files = req.files || {};
    const studentPhoto = files.studentPhoto?.[0];
    const aadhaarCard = files.aadhaarCard?.[0];
    const leavingCertificate = files.leavingCertificate?.[0];
    const marksheet = files.marksheet?.[0];

    if (!studentPhoto) {
      return res.status(400).json({
        success: false,
        message: 'Student photo is required'
      });
    }

    if (!aadhaarCard) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar card is required'
      });
    }

    if (!leavingCertificate) {
      return res.status(400).json({
        success: false,
        message: 'Leaving certificate is required'
      });
    }

    // ✅ Parse address if string
    let addressObj = address;
    if (typeof address === 'string') {
      try {
        addressObj = JSON.parse(address);
      } catch (e) {
        addressObj = { street: address };
      }
    }

    // ✅ Create admission application
    const admission = await Admission.create({
      studentName,
      fatherName,
      motherName: motherName || '',
      dateOfBirth,
      age: parseInt(age),
      gender,
      mobile,
      alternateMobile: alternateMobile || '',
      aadhaarNumber,
      address: addressObj,
      applyingForClass,
      section: section || 'A',
      lastQualification,
      previousSchool,
      lastClassPassed,
      percentage: parseFloat(percentage),
      yearOfPassing,
      studentPhoto: `/uploads/admissions/${studentPhoto.filename}`,
      aadhaarCard: `/uploads/admissions/${aadhaarCard.filename}`,
      leavingCertificate: `/uploads/admissions/${leavingCertificate.filename}`,
      marksheet: marksheet ? `/uploads/admissions/${marksheet.filename}` : null,
      status: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      data: {
        applicationNumber: admission.applicationNumber,
        studentName: admission.studentName,
        status: admission.status,
        submittedAt: admission.createdAt
      }
    });
  } catch (error) {
    console.error('Submit application error:', error);

    // ✅ Delete uploaded files if error
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        fileArray.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
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

// @desc    Check application status
// @route   GET /api/admission/status/:applicationNumber
// @access  Public
exports.checkStatus = async (req, res) => {
  try {
    const { applicationNumber } = req.params;

    const admission = await Admission.findOne({ applicationNumber })
      .select('applicationNumber studentName applyingForClass status remarks createdAt reviewedAt smsSent');

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Application not found. Please check your application number.'
      });
    }

    res.status(200).json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ADMIN ROUTES ====================

// @desc    Get all admissions with filters
// @route   GET /api/admin/admissions
// @access  Private (Admin only)
exports.getAllAdmissions = async (req, res) => {
  try {
    const {
      status,
      class: className,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (className) query.applyingForClass = className;

    if (search) {
      query.$or = [
        { applicationNumber: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { aadhaarNumber: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const admissions = await Admission.find(query)
      .populate('reviewedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Admission.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        admissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get all admissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single admission by ID
// @route   GET /api/admin/admissions/:id
// @access  Private (Admin only)
exports.getAdmissionById = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
      .populate('reviewedBy', 'name')
      .populate('studentId', 'rollNumber class section');

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    res.status(200).json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Get admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Approve admission & Auto-create student
// @route   PUT /api/admin/admissions/:id/approve
// @access  Private (Admin only)
exports.approveAdmission = async (req, res) => {
  try {
    const { remarks, section } = req.body;
    const admissionId = req.params.id;

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    if (admission.status === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Admission already approved'
      });
    }

    // ✅ Generate Username
    const cleanName = admission.studentName
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z.]/g, '');
    const year = new Date().getFullYear();
    let username = `${cleanName}.${year}`;

    // Check if username exists
    let userExists = await User.findOne({ username });
    let counter = 1;
    while (userExists) {
      username = `${cleanName}.${year}.${counter}`;
      userExists = await User.findOne({ username });
      counter++;
    }

    // ✅ Generate Password
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const password = `${admission.studentName.split(' ')[0]}@${randomNum}`;

    // ✅ Generate Roll Number
    const classNumber = admission.applyingForClass.replace('Class ', '');
    const rollPrefix = `${classNumber}${year}`;
    
    const lastStudent = await Student.findOne({
      rollNumber: { $regex: `^${rollPrefix}` }
    }).sort({ rollNumber: -1 });

    let rollNumber;
    if (lastStudent) {
      const lastNumber = parseInt(lastStudent.rollNumber.replace(rollPrefix, ''));
      rollNumber = `${rollPrefix}${String(lastNumber + 1).padStart(3, '0')}`;
    } else {
      rollNumber = `${rollPrefix}001`;
    }

    // ✅ Create User Account
    const user = await User.create({
      username,
      password,
      role: 'student',
      name: admission.studentName,
      email: null,  // No email
      phone: admission.mobile,
      isActive: true,
      admissionSource: 'online',
      admissionId: admission._id
    });

    // ✅ Create Student Profile
    const student = await Student.create({
      user: user._id,
      rollNumber,
      class: admission.applyingForClass.replace('Class ', ''),
      section: section || admission.section || 'A',
      academicYear: `${year}-${year + 1}`,
      parentName: admission.fatherName,
      parentPhone: admission.mobile,
      address: admission.address?.street || '',
      dateOfBirth: admission.dateOfBirth,
      gender: admission.gender,
      studentPhoto: admission.studentPhoto,
      aadhaarNumber: admission.aadhaarNumber
    });

    // ✅ Update Class student count
    await Class.findOneAndUpdate(
      { 
        className: admission.applyingForClass.replace('Class ', ''),
        section: section || admission.section || 'A'
      },
      { $inc: { totalStudents: 1 } }
    );

    // ✅ Update Admission status
    admission.status = 'Approved';
    admission.remarks = remarks || 'Approved by admin';
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    admission.generatedUsername = username;
    admission.generatedPassword = password;
    admission.generatedRollNumber = rollNumber;
    admission.studentId = student._id;
    admission.smsSent = false; // Will be updated when SMS is sent
    await admission.save();

    res.status(200).json({
      success: true,
      message: 'Admission approved & student account created successfully!',
      data: {
        admission: {
          applicationNumber: admission.applicationNumber,
          status: admission.status
        },
        student: {
          name: student.user ? admission.studentName : admission.studentName,
          rollNumber,
          class: student.class,
          section: student.section
        },
        credentials: {
          username,
          password,
          note: 'Please share these credentials with the student'
        }
      }
    });
  } catch (error) {
    console.error('Approve admission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Reject admission
// @route   PUT /api/admin/admissions/:id/reject
// @access  Private (Admin only)
exports.rejectAdmission = async (req, res) => {
  try {
    const { remarks } = req.body;
    const admissionId = req.params.id;

    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for rejection'
      });
    }

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    admission.status = 'Rejected';
    admission.remarks = remarks;
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    await admission.save();

    res.status(200).json({
      success: true,
      message: 'Admission rejected successfully',
      data: {
        applicationNumber: admission.applicationNumber,
        status: admission.status,
        remarks: admission.remarks
      }
    });
  } catch (error) {
    console.error('Reject admission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete admission
// @route   DELETE /api/admin/admissions/:id
// @access  Private (Admin only)
exports.deleteAdmission = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    // ✅ Delete uploaded documents
    const documents = [
      admission.studentPhoto,
      admission.aadhaarCard,
      admission.leavingCertificate,
      admission.marksheet
    ].filter(Boolean);

    documents.forEach(docPath => {
      const fullPath = path.join(__dirname, '..', docPath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    });

    // ✅ If student was created, don't delete it (only delete admission)
    await Admission.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Admission deleted successfully'
    });
  } catch (error) {
    console.error('Delete admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get admission statistics
// @route   GET /api/admin/admissions/stats
// @access  Private (Admin only)
exports.getAdmissionStats = async (req, res) => {
  try {
    const stats = await Admission.getStatistics();

    // ✅ Get class-wise breakdown
    const classWise = await Admission.aggregate([
      { $match: { status: 'Approved' } },
      {
        $group: {
          _id: '$applyingForClass',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // ✅ Get recent admissions
    const recent = await Admission.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('applicationNumber studentName applyingForClass status createdAt');

    // ✅ Get monthly breakdown
    const monthly = await Admission.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        classWise,
        recent,
        monthly
      }
    });
  } catch (error) {
    console.error('Get admission stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Bulk approve admissions
// @route   POST /api/admin/admissions/bulk-approve
// @access  Private (Admin only)
exports.bulkApproveAdmissions = async (req, res) => {
  try {
    const { admissionIds } = req.body;

    if (!admissionIds || !Array.isArray(admissionIds) || admissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one admission'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const admissionId of admissionIds) {
      try {
        const admission = await Admission.findById(admissionId);
        if (!admission || admission.status === 'Approved') {
          results.failed.push({ id: admissionId, reason: 'Not found or already approved' });
          continue;
        }

        // Generate credentials
        const cleanName = admission.studentName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
        const year = new Date().getFullYear();
        let username = `${cleanName}.${year}`;

        let userExists = await User.findOne({ username });
        let counter = 1;
        while (userExists) {
          username = `${cleanName}.${year}.${counter}`;
          userExists = await User.findOne({ username });
          counter++;
        }

        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const password = `${admission.studentName.split(' ')[0]}@${randomNum}`;

        // Generate Roll Number
        const classNumber = admission.applyingForClass.replace('Class ', '');
        const rollPrefix = `${classNumber}${year}`;
        
        const lastStudent = await Student.findOne({
          rollNumber: { $regex: `^${rollPrefix}` }
        }).sort({ rollNumber: -1 });

        let rollNumber;
        if (lastStudent) {
          const lastNumber = parseInt(lastStudent.rollNumber.replace(rollPrefix, ''));
          rollNumber = `${rollPrefix}${String(lastNumber + 1).padStart(3, '0')}`;
        } else {
          rollNumber = `${rollPrefix}001`;
        }

        // Create User
        const user = await User.create({
          username,
          password,
          role: 'student',
          name: admission.studentName,
          phone: admission.mobile,
          isActive: true,
          admissionSource: 'online',
          admissionId: admission._id
        });

        // Create Student
        const student = await Student.create({
          user: user._id,
          rollNumber,
          class: admission.applyingForClass.replace('Class ', ''),
          section: admission.section || 'A',
          academicYear: `${year}-${year + 1}`,
          parentName: admission.fatherName,
          parentPhone: admission.mobile,
          address: admission.address?.street || '',
          dateOfBirth: admission.dateOfBirth,
          gender: admission.gender
        });

        // Update Class
        await Class.findOneAndUpdate(
          { 
            className: admission.applyingForClass.replace('Class ', ''),
            section: admission.section || 'A'
          },
          { $inc: { totalStudents: 1 } }
        );

        // Update Admission
        admission.status = 'Approved';
        admission.reviewedBy = req.user.id;
        admission.reviewedAt = new Date();
        admission.generatedUsername = username;
        admission.generatedPassword = password;
        admission.generatedRollNumber = rollNumber;
        admission.studentId = student._id;
        await admission.save();

        results.success.push({
          id: admissionId,
          applicationNumber: admission.applicationNumber,
          username,
          password,
          rollNumber
        });
      } catch (err) {
        results.failed.push({ id: admissionId, reason: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk approval completed: ${results.success.length} approved, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Export admissions to CSV
// @route   GET /api/admin/admissions/export
// @access  Private (Admin only)
exports.exportAdmissions = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {};
    if (status) query.status = status;

    const admissions = await Admission.find(query).sort({ createdAt: -1 });

    // Generate CSV
    const headers = [
      'Application No', 'Student Name', 'Father Name', 'DOB', 'Age', 'Gender',
      'Mobile', 'Aadhaar', 'Class', 'Section', 'Previous School',
      'Percentage', 'Status', 'Applied Date'
    ];

    const rows = admissions.map(a => [
      a.applicationNumber,
      a.studentName,
      a.fatherName,
      new Date(a.dateOfBirth).toLocaleDateString(),
      a.age,
      a.gender,
      a.mobile,
      a.aadhaarNumber,
      a.applyingForClass,
      a.section,
      a.previousSchool,
      a.percentage,
      a.status,
      new Date(a.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=admissions-${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export admissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};