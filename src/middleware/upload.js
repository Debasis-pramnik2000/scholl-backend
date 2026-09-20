const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==================== ENSURE UPLOAD DIRECTORIES ====================
const profileDir = 'uploads/profiles';
const admissionDir = 'uploads/admissions';

[profileDir, admissionDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== STORAGE CONFIGURATIONS ====================

// ✅ Profile Photo Storage
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user?.id || req.user?._id || 'user';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${uniqueSuffix}${ext}`);
  }
});

// ✅ Admission Document Storage
const admissionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, admissionDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname || 'doc';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

// ==================== FILE FILTERS ====================

// ✅ Profile Image Filter (Only Images)
const imageFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/jpg'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, WEBP images are allowed'), false);
  }
};

// ✅ Admission Document Filter (Images + PDF)
const admissionFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/pdf'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP images and PDF files are allowed'), false);
  }
};

// ==================== MULTER INSTANCES ====================

// ✅ Profile Upload (Single Image) - For Profile Photo
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: imageFilter
});

// ✅ Admission Upload (Multiple Documents)
const uploadAdmission = multer({
  storage: admissionStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max per file
  },
  fileFilter: admissionFilter
});

// ==================== ADMISSION FIELDS CONFIG ====================
const admissionFields = uploadAdmission.fields([
  { name: 'studentPhoto', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'leavingCertificate', maxCount: 1 },
  { name: 'marksheet', maxCount: 1 }
]);

// ==================== WRAPPER FOR BACKWARD COMPATIBILITY ====================
// ✅ This makes upload.single() work as before
const upload = {
  single: (fieldName) => uploadProfile.single(fieldName),
  array: (fieldName, maxCount) => uploadProfile.array(fieldName, maxCount),
  fields: (fields) => uploadProfile.fields(fields),
  any: () => uploadProfile.any(),
  none: () => uploadProfile.none()
};

// ==================== EXPORTS ====================
module.exports = upload;
module.exports.uploadAdmission = uploadAdmission;
module.exports.admissionFields = admissionFields;
module.exports.uploadProfile = uploadProfile;