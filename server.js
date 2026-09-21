const express = require('express');

const mongoose = require('mongoose');

const cors = require('cors');

const dotenv = require('dotenv');

const helmet = require('helmet');

const xss = require('xss-clean');

const rateLimit = require('express-rate-limit');

const path = require('path');

const fs = require('fs');

// Load env vars
dotenv.config();

// Route files
const authRoutes = require('./src/routes/authRoutes');

const studentRoutes = require('./src/routes/studentRoutes');

const teacherRoutes = require('./src/routes/teacherRoutes');

const adminRoutes = require('./src/routes/adminRoutes');

const subjectRoutes = require('./src/routes/subjectRoutes');

const classRoutes = require('./src/routes/classRoutes');

const timetableRoutes = require('./src/routes/timetableRoutes');

const reportRoutes = require('./src/routes/reportRoutes');

const parentRoutes = require('./src/routes/parentRoutes');

const leaveRoutes = require('./src/routes/leaveRoutes');

const publicRoutes = require('./src/routes/publicRoutes');

const admissionPublicRoutes = require('./src/routes/admissionPublicRoutes');

const admissionAdminRoutes = require('./src/routes/admissionAdminRoutes');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// ==================== 1. HELMET (FULLY CONFIGURED) ====================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// ==================== 2. STATIC FILES (BEFORE BODY PARSER!) ====================

const uploadsPath = path.join(__dirname, 'uploads');

console.log('📁 Uploads path:', uploadsPath);

console.log('📁 Uploads exists:', fs.existsSync(uploadsPath));

app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Methods', 'GET');
  }
}));

// ==================== 3. BODY PARSER ====================

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== 4. XSS ====================

app.use(xss());

// ==================== 5. RATE LIMITING ====================

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
});

app.use('/api', limiter);

// ==================== 6. CORS (MULTIPLE ORIGINS) ====================

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://scholl-frontend-new.vercel.app/'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== 7. MODELS ====================

const User = require('./src/models/User.js');

// ==================== 8. MONGODB CONNECTION ====================

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await createDefaultAdmin();
  })
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// ==================== 9. MOUNT ROUTES ====================

// ✅ Admin admissions FIRST (specific path)
app.use('/api/admin/admissions', admissionAdminRoutes);

// ✅ Timetable routes
app.use('/api/admin/timetable', timetableRoutes);

app.use('/api/teacher/timetable', timetableRoutes);

app.use('/api/student/timetable', timetableRoutes);

// ✅ Public admission routes
app.use('/api/admission', admissionPublicRoutes);

// ✅ General routes
app.use('/api/auth', authRoutes);

app.use('/api/student', studentRoutes);

app.use('/api/student', reportRoutes);

app.use('/api/teacher', teacherRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/subjects', subjectRoutes);

app.use('/api/classes', classRoutes);

app.use('/api/parent', parentRoutes);

app.use('/api/leave', leaveRoutes);

app.use('/api/public', publicRoutes);

// ==================== ROOT ROUTE ====================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'School Management Backend API is running 🚀'
  });
});

// ==================== 10. TEST ROUTES (DEBUG) ====================

// ✅ Test uploads folder
app.get('/test-uploads', (req, res) => {
  const admissionsDir = path.join(__dirname, 'uploads', 'admissions');

  const profilesDir = path.join(__dirname, 'uploads', 'profiles');

  res.json({
    uploadsPath,
    uploadsExists: fs.existsSync(uploadsPath),
    admissionsPath: admissionsDir,
    admissionsExists: fs.existsSync(admissionsDir),
    profilesPath: profilesDir,
    profilesExists: fs.existsSync(profilesDir),
    admissionFiles: fs.existsSync(admissionsDir)
      ? fs.readdirSync(admissionsDir)
      : [],
    profileFiles: fs.existsSync(profilesDir)
      ? fs.readdirSync(profilesDir)
      : []
  });
});

// ==================== 11. HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ==================== 12. 404 HANDLER (MUST BE LAST!) ====================

app.use((req, res) => {
  console.log('❌ 404:', req.originalUrl);

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ==================== 13. ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==================== 14. CREATE DEFAULT ADMIN ====================

const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({
      username: process.env.ADMIN_USERNAME || 'admin'
    });

    if (!adminExists) {
      await User.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        name: 'System Administrator',
        email: 'admin@school.com',
        isActive: true
      });

      console.log('✅ Default admin created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  }
};

// ==================== 15. START SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`📁 Static: http://localhost:${PORT}/uploads`);
  console.log(`🧪 Test: http://localhost:${PORT}/test-uploads`);
});