const mongoose = require('mongoose');

const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters']
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },

    role: {
      type: String,
      enum: ['admin', 'teacher', 'student', 'parent'],
      required: [true, 'Role is required']
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },

    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },

    phone: {
      type: String,
      trim: true,
      default: ''
    },

    profilePicture: {
      type: String,
      default: ''
    },

    resetPasswordToken: {
      type: String
    },

    resetPasswordExpire: {
      type: Date
    },

    isActive: {
      type: Boolean,
      default: true
    },

    admissionSource: {
      type: String,
      enum: ['manual', 'online'],
      default: 'manual'
    },

    admissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admission',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Pre-save middleware - Hash password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);