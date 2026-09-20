const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  occupation: {
    type: String,
    trim: true
  },
  relationship: {
    type: String,
    enum: ['Father', 'Mother', 'Guardian'],
    default: 'Guardian'
  },
  address: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

parentSchema.index({ children: 1 });

module.exports = mongoose.model('Parent', parentSchema);