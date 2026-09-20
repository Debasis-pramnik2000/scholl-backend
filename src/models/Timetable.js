const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    uppercase: true,
    default: 'A'
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  periods: [{
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    subjectCode: {
      type: String,
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
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time (HH:MM)']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time (HH:MM)']
    },
    room: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ✅ Indexes
timetableSchema.index({ class: 1, section: 1, day: 1, academicYear: 1 }, { unique: true });
timetableSchema.index({ 'periods.teacher': 1 });
timetableSchema.index({ academicYear: 1 });

// ✅ Virtual field
timetableSchema.virtual('totalPeriods').get(function() {
  return this.periods?.length || 0;
});

// ✅✅✅ FIXED: pre-save hook removed.
// Mongoose 7+ no longer supports callback-style middleware
// (function(next) { ... next(); }) — hooks must be sync
// (no params) or async (no params, just await/return).
// The old hook was a no-op anyway, so it's simply deleted here.
// If you need pre-save logic later, add it like this instead:
//
// timetableSchema.pre('save', async function () {
//   // your logic here, no `next` param, no next() call
// });

// ✅ Static methods
timetableSchema.statics.getTimetableByClass = async function(className, section, day = null) {
  const query = { class: className, section, isActive: true };
  if (day) query.day = day;
  
  return this.find(query)
    .populate('periods.teacher', 'name email')
    .sort({ day: 1 });
};

timetableSchema.statics.getTimetableByTeacher = async function(teacherId, day = null) {
  const query = { 
    'periods.teacher': teacherId,
    isActive: true 
  };
  if (day) query.day = day;
  
  return this.find(query)
    .populate('periods.teacher', 'name email')
    .sort({ day: 1 });
};

// ✅ Instance methods
timetableSchema.methods.addPeriod = async function(periodData) {
  const exists = this.periods.some(p => p.periodNumber === periodData.periodNumber);
  if (exists) {
    throw new Error(`Period ${periodData.periodNumber} already exists`);
  }
  
  this.periods.push(periodData);
  await this.save();
  return this;
};

timetableSchema.methods.removePeriod = async function(periodNumber) {
  this.periods = this.periods.filter(p => p.periodNumber !== periodNumber);
  await this.save();
  return this;
};

timetableSchema.methods.updatePeriod = async function(periodNumber, updateData) {
  const period = this.periods.find(p => p.periodNumber === periodNumber);
  if (!period) {
    throw new Error(`Period ${periodNumber} not found`);
  }
  
  Object.assign(period, updateData);
  await this.save();
  return this;
};

// ✅ JSON transform
timetableSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});
timetableSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Timetable', timetableSchema);