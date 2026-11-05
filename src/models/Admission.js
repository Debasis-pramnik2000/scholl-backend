
const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({

  // ==================== APPLICATION NUMBER ====================

  applicationNumber: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },

  // ==================== PERSONAL INFORMATION ====================

  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters']
  },

  fatherName: {
    type: String,
    required: [true, 'Father name is required'],
    trim: true
  },

  motherName: {
    type: String,
    trim: true,
    default: ''
  },

  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },

  age: {
    type: Number,
    required: true,
    min: [3, 'Age must be at least 3'],
    max: [25, 'Age cannot exceed 25']
  },

  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: [true, 'Gender is required']
  },

  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number']
  },

  alternateMobile: {
    type: String,
    trim: true,
    default: ''
  },

  // ==================== AADHAAR ====================

  aadhaarNumber: {
    type: String,
    required: [true, 'Aadhaar number is required'],
    trim: true,
    match: [/^[0-9]{12}$/, 'Aadhaar must be 12 digits']
  },

  // ==================== ADDRESS ====================

  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },

    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },

    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },

    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^[0-9]{6}$/, 'Pincode must be 6 digits']
    }
  },

  // ==================== CLASS INFORMATION ====================

  applyingForClass: {
    type: String,
    required: [true, 'Class is required'],
    enum: [
      'Class V',
      'Class VI',
      'Class VII',
      'Class VIII',
      'Class IX',
      'Class X',
      'Class XI',
      'Class XII'
    ]
  },

  section: {
    type: String,
    default: 'A',
    uppercase: true
  },

  // ==================== EDUCATION ====================

  lastQualification: {
    type: String,
    required: [true, 'Last qualification is required'],
    trim: true
  },

  previousSchool: {
    type: String,
    required: [true, 'Previous school name is required'],
    trim: true
  },

  lastClassPassed: {
    type: String,
    required: [true, 'Last class passed is required'],
    trim: true
  },

  percentage: {
    type: Number,
    required: [true, 'Percentage is required'],
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },

  yearOfPassing: {
    type: String,
    required: [true, 'Year of passing is required'],
    trim: true
  },

  // ==================== DOCUMENTS ====================

  studentPhoto: {
    type: String,
    required: [true, 'Student photo is required']
  },

  aadhaarCard: {
    type: String,
    required: [true, 'Aadhaar card is required']
  },

  leavingCertificate: {
    type: String,
    required: [true, 'Leaving certificate is required']
  },

  marksheet: {
    type: String,
    default: null
  },

  // ==================== APPLICATION STATUS ====================

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },

  remarks: {
    type: String,
    trim: true,
    default: ''
  },

  // ==================== ADMIN ACTION ====================

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  reviewedAt: {
    type: Date,
    default: null
  },

  // ==================== GENERATED CREDENTIALS ====================

  generatedUsername: {
    type: String,
    default: null
  },

  generatedPassword: {
    type: String,
    default: null
  },

  generatedRollNumber: {
    type: String,
    default: null
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  },

  // ==================== NOTIFICATION STATUS ====================

  smsSent: {
    type: Boolean,
    default: false
  },

  smsSentAt: {
    type: Date,
    default: null
  },

  // ==================== TIMESTAMPS ====================

  createdAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});


// ============================================================
// INDEXES
// ============================================================

admissionSchema.index({ mobile: 1 });
admissionSchema.index({ status: 1 });
admissionSchema.index({ applyingForClass: 1 });
admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ status: 1, createdAt: -1 });

// Aadhaar unique only for Pending / Approved applications
admissionSchema.index(
  { aadhaarNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['Pending', 'Approved'] }
    }
  }
);


// ============================================================
// PRE-VALIDATE MIDDLEWARE
// AUTOMATIC APPLICATION NUMBER GENERATION
// ============================================================

admissionSchema.pre('validate', async function () {

  // Generate only for new admissions
  if (!this.isNew || this.applicationNumber) {
    return;
  }

  const year = new Date().getFullYear();
  const counterId = `admission-${year}`;

  try {

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('MongoDB connection is not ready');
    }

    const result = await db.collection('counters').findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    // MongoDB driver v4 and v6 compatibility
    const counterDoc = result?.value ?? result;

    if (
      !counterDoc ||
      typeof counterDoc.seq !== 'number' ||
      !Number.isFinite(counterDoc.seq)
    ) {
      throw new Error('Could not generate application number');
    }

    this.applicationNumber =
      `ADM-${year}-${String(counterDoc.seq).padStart(4, '0')}`;

  } catch (error) {

    console.error('Application number generation error:', error);

    throw new Error(
      'Unable to generate application number. Please try again.'
    );

  }

});


// ============================================================
// VIRTUAL FIELD: FULL ADDRESS
// ============================================================

admissionSchema.virtual('fullAddress').get(function () {

  if (!this.address) return '';

  const { street, city, state, pincode } = this.address;

  return `${street}, ${city}, ${state} - ${pincode}`;

});


// ============================================================
// VIRTUAL FIELD: STATUS COLOR
// ============================================================

admissionSchema.virtual('statusColor').get(function () {

  const colors = {
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'danger',
    Cancelled: 'secondary'
  };

  return colors[this.status] || 'secondary';

});


// ============================================================
// STATIC METHOD: CHECK DUPLICATE MOBILE
// ============================================================

admissionSchema.statics.checkDuplicateMobile = async function (mobile) {

  const existing = await this.findOne({
    mobile: mobile,
    status: { $in: ['Pending', 'Approved'] }
  });

  return existing;

};


// ============================================================
// STATIC METHOD: CHECK DUPLICATE AADHAAR
// ============================================================

admissionSchema.statics.checkDuplicateAadhaar = async function (aadhaarNumber) {

  const existing = await this.findOne({
    aadhaarNumber: aadhaarNumber,
    status: { $in: ['Pending', 'Approved'] }
  });

  return existing;

};


// ============================================================
// STATIC METHOD: GET STATISTICS
// ============================================================

admissionSchema.statics.getStatistics = async function () {

  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0
  };

  stats.forEach(stat => {

    result.total += stat.count;

    if (stat._id === 'Pending') result.pending = stat.count;
    if (stat._id === 'Approved') result.approved = stat.count;
    if (stat._id === 'Rejected') result.rejected = stat.count;
    if (stat._id === 'Cancelled') result.cancelled = stat.count;

  });

  return result;

};


// ============================================================
// INSTANCE METHOD: CALCULATE AGE FROM DOB
// ============================================================

admissionSchema.methods.calculateAge = function () {

  if (!this.dateOfBirth) return 0;

  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;

};


// ============================================================
// INCLUDE VIRTUALS IN JSON
// ============================================================

admissionSchema.set('toJSON', {

  virtuals: true,

  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }

});


// ============================================================
// INCLUDE VIRTUALS IN OBJECT
// ============================================================

admissionSchema.set('toObject', {
  virtuals: true
});


// ============================================================
// EXPORT MODEL
// ============================================================

module.exports = mongoose.model('Admission', admissionSchema);
