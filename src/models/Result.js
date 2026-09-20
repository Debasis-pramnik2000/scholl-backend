const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  examName: {
    type: String,
    required: true
  },
  examDate: Date,
  subjects: [{
    name: String,
    marksObtained: Number,
    totalMarks: Number,
    grade: String,
    remarks: String
  }],
  totalMarks: Number,
  percentage: Number,
  grade: String,
  rank: Number,
  academicYear: {
    type: String,
    required: true
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedDate: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Result', resultSchema);