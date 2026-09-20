const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    let additionalData = {};

    if (user.role === 'student') {
      const student = await Student.findOne({ user: user._id });

      if (student) {
        additionalData = {
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section
        };
      }
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        ...additionalData
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    let additionalData = {};

    if (user.role === 'student') {
      const student = await Student.findOne({ user: user._id });

      if (student) {
        additionalData = {
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          address: student.address,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          admissionDate: student.admissionDate
        };
      }
    }

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        ...additionalData
      }
    });
  } catch (error) {
    console.error('Get user error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      profilePicture,
      parentName,
      parentPhone,
      address
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        email,
        phone,
        profilePicture
      },
      { returnDocument: "after", runValidators: true }
    ).select('-password');

    if (req.user.role === 'student') {
      await Student.findOneAndUpdate(
        { user: req.user.id },
        {
          parentName,
          parentPhone,
          address
        },
       { returnDocument: "after", runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset token generated',
      resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: {
        $gt: Date.now()
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload profile photo
// @route   POST /api/auth/upload-photo
// @access  Private
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Get user safely
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile photo if exists
    if (user.profilePicture) {
      const oldPhotoPath = path.join(
        __dirname,
        '..',
        user.profilePicture
      );

      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }

      // Also delete thumbnails
      const dir = path.dirname(oldPhotoPath);
      const basename = path.basename(
        oldPhotoPath,
        path.extname(oldPhotoPath)
      );

      const extensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp'
      ];

      const suffixes = [
        '-small',
        '-medium',
        '-large'
      ];

      for (let suffix of suffixes) {
        for (let ext of extensions) {
          const thumbPath = path.join(
            dir,
            `${basename}${suffix}${ext}`
          );

          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }
        }
      }
    }

    // Update user with new photo URL
    const photoUrl =
      `/uploads/profiles/${path.basename(req.file.filename)}`;

    user.profilePicture = photoUrl;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePicture: photoUrl
      }
    });
  } catch (error) {
    console.error('Upload photo error:', error);

    // Delete uploaded file if error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Remove profile photo
// @route   DELETE /api/auth/remove-photo
// @access  Private
exports.removeProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'No profile photo to remove'
      });
    }

    const photoPath = path.join(
      __dirname,
      '..',
      user.profilePicture
    );

    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }

    const dir = path.dirname(photoPath);
    const basename = path.basename(
      photoPath,
      path.extname(photoPath)
    );

    const extensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp'
    ];

    const suffixes = [
      '-small',
      '-medium',
      '-large'
    ];

    for (let suffix of suffixes) {
      for (let ext of extensions) {
        const thumbPath = path.join(
          dir,
          `${basename}${suffix}${ext}`
        );

        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }
    }

    user.profilePicture = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile photo removed successfully'
    });
  } catch (error) {
    console.error('Remove photo error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};