const multer = require('multer');
const path = require('path');

// ==================== MEMORY STORAGE ====================
// Cloudinary-তে আপলোডের জন্য মেমরি স্টোরেজ ব্যবহার করুন, লোকাল ডিস্কে ফাইল লিখবেন না
const memoryStorage = multer.memoryStorage();

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
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});

const uploadAdmission = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: admissionFilter
});

const uploadMaterial = multer({
  storage: memoryStorage,
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