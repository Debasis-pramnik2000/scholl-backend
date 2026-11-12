const Admission = require('../models/Admission');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

// ============================================================
// HELPER: DELETE UPLOADED FILES
// ============================================================

const deleteUploadedFiles = (files) => {
  if (!files) return;
  // memoryStorage ব্যবহার করায় ডিস্কে ফাইল নেই — কিছু মুছতে হবে না
};

// ============================================================
// HELPER: HANDLE DUPLICATE KEY ERROR
// ============================================================

const handleDuplicateError = (error, res) => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];

    let message = 'Duplicate record already exists';

    if (field === 'applicationNumber') {
      message = 'Application number already exists. Please try again.';
    } else if (field === 'aadhaarNumber') {
      message = 'An application already exists with this Aadhaar number.';
    } else if (field === 'mobile') {
      message = 'An application already exists with this mobile number.';
    }

    return res.status(400).json({
      success: false,
      message
    });
  }

  return null;
};

// ============================================================
// PUBLIC ROUTES
// ============================================================

// @desc Submit admission application
// @route POST /api/admission/apply
// @access Public
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

    if (
      !studentName ||
      !fatherName ||
      !dateOfBirth ||
      !gender ||
      !mobile ||
      !aadhaarNumber ||
      !applyingForClass
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    const existingMobile = await Admission.checkDuplicateMobile(mobile);

    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: `An application already exists with this mobile number. Application No: ${existingMobile.applicationNumber}`
      });
    }

    const existingAadhaar = await Admission.checkDuplicateAadhaar(aadhaarNumber);

    if (existingAadhaar) {
      return res.status(400).json({
        success: false,
        message: `An application already exists with this Aadhaar number. Application No: ${existingAadhaar.applicationNumber}`
      });
    }

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

    let addressObj = address;

    if (typeof address === 'string') {
      try {
        addressObj = JSON.parse(address);
      } catch (error) {
        addressObj = { street: address };
      }
    }

    if (!addressObj || typeof addressObj !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Valid address is required'
      });
    }

    // Cloudinary-তে ফাইল আপলোড
    const studentPhotoResult = await uploadToCloudinary(
      studentPhoto.buffer,
      'school/admissions'
    );

    const aadhaarCardResult = await uploadToCloudinary(
      aadhaarCard.buffer,
      'school/admissions'
    );

    const leavingCertificateResult = await uploadToCloudinary(
      leavingCertificate.buffer,
      'school/admissions'
    );

    let marksheetResult = null;

    if (marksheet) {
      marksheetResult = await uploadToCloudinary(
        marksheet.buffer,
        'school/admissions'
      );
    }

    const admission = await Admission.create({
      studentName,
      fatherName,
      motherName: motherName || '',

      dateOfBirth,
      age: parseInt(age, 10),
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

      studentPhoto: studentPhotoResult.url,
      aadhaarCard: aadhaarCardResult.url,
      leavingCertificate: leavingCertificateResult.url,
      marksheet: marksheetResult ? marksheetResult.url : null,

      status: 'Pending'
    });

    return res.status(201).json({
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

    deleteUploadedFiles(req.files);

    const duplicateResponse = handleDuplicateError(error, res);

    if (duplicateResponse) return duplicateResponse;

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);

      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ============================================================
// CHECK APPLICATION STATUS
// ============================================================

exports.checkStatus = async (req, res) => {
  try {
    const { applicationNumber } = req.params;

    const admission = await Admission.findOne({ applicationNumber }).select(
      'applicationNumber studentName applyingForClass status remarks createdAt reviewedAt smsSent'
    );

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Application not found. Please check your application number.'
      });
    }

    return res.status(200).json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Check status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// ADMIN: GET ALL ADMISSIONS
// ============================================================

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

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);

    const query = {};

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

    const skip = (currentPage - 1) * pageLimit;

    const allowedSortFields = ['createdAt', 'studentName', 'applicationNumber', 'status'];

    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const sort = {};
    sort[safeSortBy] = sortOrder === 'desc' ? -1 : 1;

    const admissions = await Admission.find(query)
      .populate('reviewedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(pageLimit);

    const total = await Admission.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        admissions,
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit)
        }
      }
    });
  } catch (error) {
    console.error('Get all admissions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// ADMIN: GET SINGLE ADMISSION
// ============================================================

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

    return res.status(200).json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Get admission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// HELPER: GENERATE USERNAME
// ============================================================

const generateUsername = async (studentName) => {
  const cleanName = studentName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '');

  const year = new Date().getFullYear();

  const baseUsername = `${cleanName || 'student'}.${year}`;

  let username = baseUsername;
  let counter = 1;

  while (await User.exists({ username })) {
    username = `${baseUsername}.${counter}`;
    counter++;
  }

  return username;
};

// ============================================================
// HELPER: GENERATE ROLL NUMBER
// ============================================================

const generateRollNumber = async (className, year) => {
  const classNumber = className.replace('Class ', '');

  const rollPrefix = `${classNumber}${year}`;

  const lastStudent = await Student.findOne({
    rollNumber: {
      $regex: `^${rollPrefix}`
    }
  }).sort({ rollNumber: -1 });

  let rollNumber;

  if (lastStudent) {
    const lastNumber = parseInt(
      lastStudent.rollNumber.replace(rollPrefix, ''),
      10
    );

    rollNumber = `${rollPrefix}${String(lastNumber + 1).padStart(3, '0')}`;
  } else {
    rollNumber = `${rollPrefix}001`;
  }

  return rollNumber;
};

// ============================================================
// HELPER: CREATE STUDENT FROM ADMISSION
// ============================================================

const createStudentFromAdmission = async (admission, section) => {
  const year = new Date().getFullYear();

  const username = await generateUsername(admission.studentName);

  const randomNum = Math.floor(1000 + Math.random() * 9000);

  const password = `${admission.studentName.split(' ')[0]}@${randomNum}`;

  const rollNumber = await generateRollNumber(
    admission.applyingForClass,
    year
  );

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

  await Class.findOneAndUpdate(
    {
      className: admission.applyingForClass.replace('Class ', ''),
      section: section || admission.section || 'A'
    },
    {
      $inc: { totalStudents: 1 }
    }
  );

  return {
    user,
    student,
    username,
    password,
    rollNumber
  };
};

// ============================================================
// ADMIN: APPROVE ADMISSION
// ============================================================

exports.approveAdmission = async (req, res) => {
  try {
    const { remarks, section } = req.body;

    const admission = await Admission.findById(req.params.id);

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

    const result = await createStudentFromAdmission(admission, section);

    const { student, username, password, rollNumber } = result;

    admission.status = 'Approved';
    admission.remarks = remarks || 'Approved by admin';
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    admission.generatedUsername = username;
    admission.generatedPassword = password;
    admission.generatedRollNumber = rollNumber;
    admission.studentId = student._id;
    admission.smsSent = false;

    await admission.save();

    return res.status(200).json({
      success: true,
      message: 'Admission approved & student account created successfully!',
      data: {
        admission: {
          applicationNumber: admission.applicationNumber,
          status: admission.status
        },
        student: {
          name: admission.studentName,
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

    const duplicateResponse = handleDuplicateError(error, res);

    if (duplicateResponse) return duplicateResponse;

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ============================================================
// ADMIN: REJECT ADMISSION
// ============================================================

exports.rejectAdmission = async (req, res) => {
  try {
    const { remarks } = req.body;

    const admission = await Admission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for rejection'
      });
    }

    admission.status = 'Rejected';
    admission.remarks = remarks;
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();

    await admission.save();

    return res.status(200).json({
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

    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ============================================================
// ADMIN: DELETE ADMISSION
// ============================================================

exports.deleteAdmission = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    // Cloudinary ফাইল মুছতে চাইলে এখানে deleteFromCloudinary ব্যবহার করা যাবে
    // (publicId সংরক্ষণ করা হলে)

    await Admission.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Admission deleted successfully'
    });
  } catch (error) {
    console.error('Delete admission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// ADMIN: ADMISSION STATISTICS
// ============================================================

exports.getAdmissionStats = async (req, res) => {
  try {
    const stats = await Admission.getStatistics();

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

    const recent = await Admission.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        'applicationNumber studentName applyingForClass status createdAt'
      );

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
      {
        $sort: {
          '_id.year': -1,
          '_id.month': -1
        }
      },
      { $limit: 6 }
    ]);

    return res.status(200).json({
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

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// ADMIN: BULK APPROVE ADMISSIONS
// ============================================================

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
          results.failed.push({
            id: admissionId,
            reason: 'Not found or already approved'
          });

          continue;
        }

        const result = await createStudentFromAdmission(
          admission,
          admission.section || 'A'
        );

        const { student, username, password, rollNumber } = result;

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
      } catch (error) {
        console.error(`Bulk approval failed for ${admissionId}:`, error);

        results.failed.push({
          id: admissionId,
          reason: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk approval completed: ${results.success.length} approved, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Bulk approve error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================================
// ADMIN: EXPORT ADMISSIONS TO CSV
// ============================================================

exports.exportAdmissions = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    const admissions = await Admission.find(query).sort({ createdAt: -1 });

    const headers = [
      'Application No',
      'Student Name',
      'Father Name',
      'DOB',
      'Age',
      'Gender',
      'Mobile',
      'Aadhaar',
      'Class',
      'Section',
      'Previous School',
      'Percentage',
      'Status',
      'Applied Date'
    ];

    const escapeCSV = (value) => {
      const safeValue = String(value ?? '');

      return `"${safeValue.replace(/"/g, '""')}"`;
    };

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
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=admissions-${Date.now()}.csv`
    );

    return res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('Export admissions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};