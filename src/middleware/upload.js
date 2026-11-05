const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==================== ABSOLUTE PATHS ====================
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const profileDir = path.join(PROJECT_ROOT, 'uploads', 'profiles');
const admissionDir = path.join(PROJECT_ROOT, 'uploads', 'admissions');
const materialDir = path.join(PROJECT_ROOT, 'uploads', 'materials');

console.log('📁 Profile Dir:', profileDir);
console.log('📁 Admission Dir:', admissionDir);
console.log('📁 Material Dir:', materialDir);

// Ensure directories exist
[profileDir, admissionDir, materialDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('✅ Created:', dir);
  } else {
    console.log('✅ Exists:', dir);
  }
});

// ==================== STORAGE CONFIGURATIONS ====================

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

const materialStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, materialDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user?.id || req.user?._id || 'user';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${uniqueSuffix}${ext}`);
  }
});

// ==================== FILE FILTERS ====================

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

const materialFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, PPT, PPTX, MP4, Images, ZIP files are allowed'), false);
  }
};

// ==================== MULTER INSTANCES ====================

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});

const uploadAdmission = multer({
  storage: admissionStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: admissionFilter
});

const uploadMaterial = multer({
  storage: materialStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: materialFilter
});

// ==================== ADMISSION FIELDS ====================
const admissionFields = uploadAdmission.fields([
  { name: 'studentPhoto', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'leavingCertificate', maxCount: 1 },
  { name: 'marksheet', maxCount: 1 }
]);

// ==================== WRAPPER ====================
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
module.exports.uploadMaterial = uploadMaterial;