const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  section: {
    type: String,
    default: 'A',
    trim: true,
    uppercase: true
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  classTeacherName: {
    type: String,
    trim: true
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  subjects: [{
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    name: String,
    code: String,
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    teacherName: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  roomNumber: {
    type: String,
    trim: true,
    default: ''
  },
  totalStudents: {
    type: Number,
    default: 0,
    min: [0, 'Total students cannot be negative']
  },
  maxStudents: {
    type: Number,
    default: 50,
    min: [1, 'Maximum students must be at least 1']
  },
  description: {
    type: String,
    trim: true,
    default: ''
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

// ✅ FIX: Only indexes - No duplicate
classSchema.index({ className: 1, section: 1, academicYear: 1 }, { unique: true });
classSchema.index({ classTeacher: 1 });
classSchema.index({ isActive: 1 });

module.exports = mongoose.model('Class', classSchema);