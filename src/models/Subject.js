
const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true
    },

    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z0-9]{3,10}$/,
        'Subject code must be 3-10 alphanumeric characters'
      ]
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    class: {
      type: String,
      required: [true, 'Class is required'],
      trim: true
    },

    section: {
      type: String,
      default: 'A',
      trim: true,
      uppercase: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    teacherName: {
      type: String,
      trim: true
    },

    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true
    },

    totalMarks: {
      type: Number,
      default: 100,
      min: [0, 'Total marks cannot be negative']
    },

    passingMarks: {
      type: Number,
      default: 33,
      min: [0, 'Passing marks cannot be negative']
    },

    theoryMarks: {
      type: Number,
      default: 70,
      min: [0, 'Theory marks cannot be negative']
    },

    practicalMarks: {
      type: Number,
      default: 30,
      min: [0, 'Practical marks cannot be negative']
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
  },
  {
    timestamps: true
  }
);

// Indexes
subjectSchema.index({ name: 1 });
subjectSchema.index({ class: 1, section: 1 });
subjectSchema.index({ teacher: 1 });
subjectSchema.index({ academicYear: 1 });

module.exports = mongoose.model('Subject', subjectSchema);