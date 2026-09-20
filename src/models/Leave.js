const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  role: {
    type: String,
    enum: ['student', 'teacher'],
    required: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },

  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },

  class: {
    type: String,
    trim: true
  },

  section: {
    type: String,
    trim: true,
    uppercase: true
  },

  leaveType: {
    type: String,
    enum: [
      'Casual Leave',
      'Medical Leave',
      'Emergency Leave',
      'Study Leave',
      'Other'
    ],
    required: true
  },

  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true
  },

  fromDate: {
    type: Date,
    required: [true, 'From date is required']
  },

  toDate: {
    type: Date,
    required: [true, 'To date is required']
  },

  totalDays: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedDate: {
    type: Date
  },

  remarks: {
    type: String,
    trim: true
  },

  attachments: [{
    type: String
  }],

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate total days
leaveSchema.pre('save', async function() {
  if (this.fromDate && this.toDate) {
    const from = new Date(this.fromDate);
    const to = new Date(this.toDate);

    const diffTime = Math.abs(to - from);
    const diffDays =
      Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    this.totalDays = diffDays;
  }
});

// Indexes
leaveSchema.index({ user: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

// Virtual field
leaveSchema.virtual('isOverlapping').get(function() {
  return false;
});

// Static method to get leave count for a user in a month
leaveSchema.statics.getLeaveCount = async function(userId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const leaves = await this.find({
    user: userId,
    status: 'Approved',
    fromDate: { $lte: endDate },
    toDate: { $gte: startDate }
  });

  let totalDays = 0;

  leaves.forEach(leave => {
    totalDays += leave.totalDays || 0;
  });

  return totalDays;
};

// Static method to check if user can apply for leave
leaveSchema.statics.canApplyForLeave = async function(
  userId,
  month,
  year,
  maxLeaves = 4
) {
  const usedLeaves = await this.getLeaveCount(
    userId,
    month,
    year
  );

  return usedLeaves < maxLeaves;
};

leaveSchema.set('toJSON', { virtuals: true });
leaveSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Leave', leaveSchema);