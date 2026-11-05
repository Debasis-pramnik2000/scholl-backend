const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  qualification: {
    type: String,
    trim: true,
    default: ''
  },
  specialization: {
    type: String,
    trim: true,
    default: ''
  },
  department: {
    type: String,
    enum: ['Science', 'Commerce', 'Arts', 'Engineering', 'Medical', 'Other'],
    default: 'Other'
  },
  experience: {
    type: Number,
    default: 0,
    min: [0, 'Experience cannot be negative']
  },
  previousInstitution: {
    type: String,
    trim: true,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Other'
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  subjects: [{
    name: {
      type: String,
      trim: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  joiningDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

teacherSchema.pre('save', function() {
  if (this.employeeId) {
    this.employeeId = this.employeeId.toUpperCase();
  }
});

teacherSchema.index({ department: 1 });
teacherSchema.index({ isActive: 1 });

module.exports = mongoose.model('Teacher', teacherSchema);