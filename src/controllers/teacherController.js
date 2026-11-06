const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const Timetable = require('../models/Timetable');
const StudyMaterial = require('../models/StudyMaterial');
const mongoose = require('mongoose');

// ======================================================
// HELPER: GET TEACHER SUBJECTS
// ======================================================

const getTeacherSubjects = async (teacher, userId) => {
  const subjectMap = new Map();

  if (teacher && Array.isArray(teacher.subjects)) {
    teacher.subjects.forEach((item) => {
      if (item && item.subjectId && item.isActive !== false) {
        const subject = item.subjectId;
        const subjectId = subject._id || subject;

        if (subjectId) {
          subjectMap.set(subjectId.toString(), {
            _id: subjectId,
            name: subject.name || item.name || 'Subject',
            code: subject.code || item.code || '',
            description: subject.description || '',
            class: subject.class || '',
            section: subject.section || ''
          });
        }
      }
    });
  }

  const directSubjects = await Subject.find({
    teacher: userId,
    isActive: true
  }).select('_id name code description class section academicYear');

  directSubjects.forEach((subject) => {
    subjectMap.set(subject._id.toString(), {
      _id: subject._id,
      name: subject.name,
      code: subject.code || '',
      description: subject.description || '',
      class: subject.class || '',
      section: subject.section || '',
      academicYear: subject.academicYear || ''
    });
  });

  return Array.from(subjectMap.values());
};

// ======================================================
// HELPER: BUILD CLASS+SECTION MAP (শুধু subject teacher)
// ======================================================

const buildClassSectionMap = async (userId) => {
  const subjectAssigned = await Subject.find({
    teacher: userId,
    isActive: true
  });

  const map = new Map();

  subjectAssigned.forEach((sub) => {
    const key = `${sub.class}|${sub.section}`;
    if (!map.has(key)) {
      map.set(key, {
        _id: null,
        className: sub.class,
        section: sub.section,
        academicYear: sub.academicYear,
        classTeacher: null,
        isClassTeacher: false,
        subjects: []
      });
    }
    const entry = map.get(key);
    const exists = entry.subjects.find(
      (s) => s._id?.toString() === sub._id.toString()
    );
    if (!exists) {
      entry.subjects.push({
        _id: sub._id,
        name: sub.name,
        code: sub.code || ''
      });
    }
  });

  for (const entry of map.values()) {
    if (!entry._id) {
      const cls = await Class.findOne({
        className: entry.className,
        section: entry.section
      });
      if (cls) entry._id = cls._id;
    }
  }

  return Array.from(map.values());
};

// ======================================================
// PROFILE
// ======================================================

exports.getTeacherProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const teacher = await Teacher.findOne({ user: req.user.id });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        qualification: teacher?.qualification || '',
        specialization: teacher?.specialization || '',
        employeeId: teacher?.employeeId || '',
        experience: teacher?.experience || 0
      }
    });
  } catch (error) {
    console.error('Get teacher profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// DASHBOARD
// ======================================================

exports.getTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).populate({
      path: 'subjects.subjectId',
      select: 'name code description class section academicYear'
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const classSectionList = await buildClassSectionMap(req.user.id);
    const teacherSubjects = await getTeacherSubjects(teacher, req.user.id);

    const classesWithCount = await Promise.all(
      classSectionList.map(async (cls) => {
        const studentCount = await Student.countDocuments({
          class: cls.className,
          section: cls.section
        });

        return {
          _id: cls._id || `${cls.className}-${cls.section}`,
          className: cls.className,
          section: cls.section,
          studentCount,
          subjectCount: cls.subjects.length,
          subjects: cls.subjects
        };
      })
    );

    const orConditions = classSectionList.map((c) => ({
      class: c.className,
      section: c.section
    }));

    let myStudents = 0;
    if (orConditions.length > 0) {
      myStudents = await Student.countDocuments({ $or: orConditions });
    }

    const totalSubjects = teacherSubjects.length;

    const notices = await Notice.find({
      targetRoles: 'teacher',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        teacher: {
          name: req.user.name,
          employeeId: teacher.employeeId,
          qualification: teacher.qualification || '',
          specialization: teacher.specialization || ''
        },
        statistics: {
          totalClasses: classesWithCount.length,
          totalStudents: myStudents,
          myStudents,
          totalSubjects,
          todayClasses: 0,
          todayAttendance: 0
        },
        classes: classesWithCount,
        todayTimetable: [],
        recentNotices: notices
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ======================================================
// CLASS MANAGEMENT
// ======================================================

exports.getAssignedClasses = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user.id }).populate({
      path: 'subjects.subjectId',
      select: 'name code description class section academicYear'
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const classSectionList = await buildClassSectionMap(req.user.id);

    const classesWithCount = await Promise.all(
      classSectionList.map(async (cls) => {
        const studentCount = await Student.countDocuments({
          class: cls.className,
          section: cls.section
        });

        return {
          _id: cls._id || `${cls.className}-${cls.section}`,
          className: cls.className,
          section: cls.section,
          academicYear: cls.academicYear,
          studentCount,
          subjectCount: cls.subjects.length,
          subjects: cls.subjects
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: classesWithCount
    });
  } catch (error) {
    console.error('Get assigned classes error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.classId);

    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const subjectAssigned = await Subject.findOne({
      teacher: req.user.id,
      class: classData.className,
      section: classData.section,
      isActive: true
    });

    if (!subjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this class'
      });
    }

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: classData.className,
      section: classData.section,
      isActive: true
    }).select('_id name code');

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    })
      .populate('user', 'name email phone profilePicture')
      .sort({ rollNumber: 1 });

    return res.status(200).json({
      success: true,
      data: {
        class: {
          ...classData.toObject(),
          subjects: teacherSubjects.map(s => ({ _id: s._id, name: s.name, code: s.code }))
        },
        students
      }
    });
  } catch (error) {
    console.error('Get class students error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ======================================================
// ATTENDANCE
// ======================================================

exports.markStudentAttendance = async (req, res) => {
  try {
    const { studentId, class: className, section, status, remarks, latitude, longitude } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const subjectAssigned = await Subject.findOne({
      teacher: req.user.id,
      class: className || student.class,
      section: section || student.section,
      isActive: true
    });

    if (!subjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to mark attendance for this class'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await Attendance.findOne({
      student: studentId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    const attendance = await Attendance.create({
      student: studentId,
      user: student.user,
      class: className || student.class,
      section: section || student.section,
      status: status || 'Present',
      markedBy: req.user.id,
      checkInTime: new Date(),
      location: {
        latitude: latitude || null,
        longitude: longitude || null
      },
      remarks: remarks || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

exports.getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const subjectAssigned = await Subject.findOne({
      teacher: req.user.id,
      class: classData.className,
      section: classData.section,
      isActive: true
    });

    if (!subjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this class'
      });
    }

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    }).populate('user', 'name');

    let queryDate = date ? new Date(date) : new Date();
    queryDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(queryDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const attendanceRecords = await Attendance.find({
      student: { $in: students.map((s) => s._id) },
      date: { $gte: queryDate, $lt: nextDate }
    });

    const attendanceData = students.map((student) => {
      const record = attendanceRecords.find(
        (a) => a.student.toString() === student._id.toString()
      );

      return {
        student: {
          _id: student._id,
          rollNumber: student.rollNumber,
          name: student.user?.name || 'Unknown'
        },
        status: record?.status || 'Absent',
        checkInTime: record?.checkInTime || null,
        location: record?.location || null,
        remarks: record?.remarks || ''
      };
    });

    const present = attendanceData.filter((a) => a.status === 'Present').length;
    const absent = attendanceData.filter((a) => a.status === 'Absent').length;
    const late = attendanceData.filter((a) => a.status === 'Late').length;

    return res.status(200).json({
      success: true,
      data: {
        class: classData,
        date: queryDate,
        summary: {
          total: students.length,
          present,
          absent,
          late,
          percentage:
            students.length > 0
              ? ((present / students.length) * 100).toFixed(2)
              : 0
        },
        records: attendanceData
      }
    });
  } catch (error) {
    console.error('Get class attendance error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const subjectAssigned = await Subject.findOne({
      teacher: req.user.id,
      class: classData.className,
      section: classData.section,
      isActive: true
    });

    if (!subjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this class'
      });
    }

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    }).populate('user', 'name');

    let startDate;
    let endDate;

    if (month && year) {
      startDate = new Date(Number(year), Number(month) - 1, 1);
      endDate = new Date(Number(year), Number(month), 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const attendanceRecords = await Attendance.find({
      student: { $in: students.map((s) => s._id) },
      date: { $gte: startDate, $lte: endDate }
    });

    const dailyReport = {};

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyReport[dateStr] = { date: dateStr, present: 0, absent: 0, late: 0 };
    }

    attendanceRecords.forEach((record) => {
      const dateStr = record.date.toISOString().split('T')[0];
      const status = record.status?.toLowerCase();

      if (dailyReport[dateStr] && dailyReport[dateStr][status] !== undefined) {
        dailyReport[dateStr][status]++;
      }
    });

    const studentReport = students.map((student) => {
      const records = attendanceRecords.filter(
        (a) => a.student.toString() === student._id.toString()
      );

      const present = records.filter((a) => a.status === 'Present').length;
      const total = records.length;

      return {
        student: {
          _id: student._id,
          rollNumber: student.rollNumber,
          name: student.user?.name || 'Unknown'
        },
        present,
        absent: total - present,
        total,
        percentage: total > 0 ? ((present / total) * 100).toFixed(2) : 0
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        class: classData,
        period: { start: startDate, end: endDate },
        dailyReport: Object.values(dailyReport),
        studentReport,
        summary: {
          totalStudents: students.length,
          totalDays: Object.keys(dailyReport).length
        }
      }
    });
  } catch (error) {
    console.error('Get attendance report error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// MARKS / GRADES — Subject-level
// ======================================================

const calculateGrade = (marks, total) => {
  const p = total > 0 ? (marks / total) * 100 : 0;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C+';
  if (p >= 40) return 'C';
  if (p >= 33) return 'D';
  return 'F';
};

exports.enterMarks = async (req, res) => {
  try {
    const {
      studentId,
      class: className,
      section,
      examName,
      examDate,
      subjects,
      academicYear
    } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const finalClass = className || student.class;
    const finalSection = section || student.section;
    const finalYear = academicYear || new Date().getFullYear().toString();

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: finalClass,
      section: finalSection,
      isActive: true
    }).select('_id name code');

    if (teacherSubjects.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to any subject in this class'
      });
    }

    const teacherSubjectNames = teacherSubjects.map(s => s.name);
    const incomingSubjects = (subjects || []).filter(s =>
      teacherSubjectNames.includes(s.name)
    );

    if (incomingSubjects.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You can only enter marks for your assigned subjects'
      });
    }

    const exam = await Result.findOne({
      class: finalClass,
      section: finalSection,
      examName,
      academicYear: finalYear
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found. Please ask admin to create this exam.'
      });
    }

    const subjectDoc = teacherSubjects.find(s => s.name === incomingSubjects[0].name);

    const normalizedSubjects = incomingSubjects.map(s => ({
      name: s.name,
      marksObtained: Number(s.marksObtained) || 0,
      totalMarks: Number(s.totalMarks) || 100,
      grade: calculateGrade(Number(s.marksObtained) || 0, Number(s.totalMarks) || 100),
      remarks: s.remarks || '',
      teacher: req.user.id,
      published: false
    }));

    let result = await Result.findOne({
      student: studentId,
      examName,
      class: finalClass,
      section: finalSection,
      academicYear: finalYear
    });

    if (result) {
      const existingOthers = (result.subjects || []).filter(
        s => !teacherSubjectNames.includes(s.name)
      );
      result.subjects = [...existingOthers, ...normalizedSubjects];
    } else {
      result = new Result({
        student: studentId,
        class: finalClass,
        section: finalSection,
        examName,
        examDate: examDate || exam.examDate || new Date(),
        subjects: normalizedSubjects,
        academicYear: finalYear
      });
    }

    await result.save();

    return res.status(201).json({
      success: true,
      message: 'Marks entered successfully',
      data: result
    });
  } catch (error) {
    console.error('Enter marks error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

exports.getClassMarks = async (req, res) => {
  try {
    const { classId } = req.params;
    const { examName } = req.query;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const subjectAssigned = await Subject.findOne({
      teacher: req.user.id,
      class: classData.className,
      section: classData.section,
      isActive: true
    });

    if (!subjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this class'
      });
    }

    let query = {
      class: classData.className,
      section: classData.section
    };
    if (examName) query.examName = examName;

    const results = await Result.find(query)
      .populate('student', 'rollNumber')
      .sort({ 'student.rollNumber': 1 });

    return res.status(200).json({
      success: true,
      data: {
        class: classData,
        results
      }
    });
  } catch (error) {
    console.error('Get class marks error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getResultsByClass = async (req, res) => {
  try {
    const { class: className, section } = req.query;

    const isSubjectTeacher = await Subject.findOne({
      teacher: req.user.id,
      class: className,
      section,
      isActive: true
    });

    if (!isSubjectTeacher) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized'
      });
    }

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: className,
      section,
      isActive: true
    }).select('name');

    const teacherSubjectNames = teacherSubjects.map(s => s.name);

    const results = await Result.find({ class: className, section })
      .populate('student', 'rollNumber')
      .sort({ examDate: -1 });

    const filteredResults = results.map(r => {
      const obj = r.toObject();
      obj.subjects = (obj.subjects || []).filter(s =>
        teacherSubjectNames.includes(s.name)
      );
      return obj;
    }).filter(r => r.subjects.length > 0);

    return res.status(200).json({
      success: true,
      data: filteredResults
    });
  } catch (error) {
    console.error('Get results error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateMarks = async (req, res) => {
  try {
    const { subjects } = req.body;

    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: result.class,
      section: result.section,
      isActive: true
    }).select('name');

    if (teacherSubjects.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update these marks'
      });
    }

    const teacherSubjectNames = teacherSubjects.map(s => s.name);

    const updatedSubjects = (result.subjects || []).map(existing => {
      if (teacherSubjectNames.includes(existing.name)) {
        const incoming = (subjects || []).find(s => s.name === existing.name);
        if (incoming) {
          if (existing.published && existing.editDeadline &&
              new Date() > new Date(existing.editDeadline)) {
            return existing;
          }
          return {
            ...existing.toObject?.() || existing,
            marksObtained: Number(incoming.marksObtained) || 0,
            totalMarks: Number(incoming.totalMarks) || 100,
            grade: calculateGrade(Number(incoming.marksObtained) || 0, Number(incoming.totalMarks) || 100)
          };
        }
      }
      return existing;
    });

    result.subjects = updatedSubjects;
    await result.save();

    return res.status(200).json({
      success: true,
      message: 'Marks updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Update marks error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentMarks = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: student.class,
      section: student.section,
      isActive: true
    }).select('name');

    if (teacherSubjects.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this student's marks"
      });
    }

    const teacherSubjectNames = teacherSubjects.map(s => s.name);

    const results = await Result.find({ student: studentId }).sort({ examDate: -1 });

    const filtered = results.map(r => {
      const obj = r.toObject();
      obj.subjects = (obj.subjects || []).filter(s =>
        teacherSubjectNames.includes(s.name)
      );
      return obj;
    }).filter(r => r.subjects.length > 0);

    return res.status(200).json({
      success: true,
      data: { student, results: filtered }
    });
  } catch (error) {
    console.error('Get student marks error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// STUDY MATERIALS
// ======================================================

exports.uploadStudyMaterial = async (req, res) => {
  try {
    const { title, description, subject, class: className, section } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const isSubjectTeacher = await Subject.findOne({
      teacher: userId,
      class: className,
      section,
      isActive: true
    });

    if (!isSubjectTeacher) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to upload materials for this class'
      });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${req.file.filename}`;
    const rawExt = req.file.originalname.split('.').pop().toLowerCase();
    const allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'png', 'mp4'];
    const fileType = allowedTypes.includes(rawExt) ? rawExt : 'other';

    const material = await StudyMaterial.create({
      title, description, subject,
      class: className, section,
      uploadedBy: userId,
      fileUrl, fileType,
      fileSize: req.file.size,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Study material uploaded successfully',
      data: material
    });
  } catch (error) {
    console.error('Upload study material error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

exports.getStudyMaterials = async (req, res) => {
  try {
    const { class: className, section, subject } = req.query;
    const query = { uploadedBy: req.user.id };
    if (className) query.class = className;
    if (section) query.section = section;
    if (subject) query.subject = subject;

    const materials = await StudyMaterial.find(query)
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: materials });
  } catch (error) {
    console.error('Get study materials error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteStudyMaterial = async (req, res) => {
  try {
    const material = await StudyMaterial.findOne({
      _id: req.params.id,
      uploadedBy: req.user.id
    });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found or you are not authorized'
      });
    }
    await StudyMaterial.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Study material deleted successfully'
    });
  } catch (error) {
    console.error('Delete study material error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// PROFILE UPDATE
// ======================================================

exports.updateTeacherProfile = async (req, res) => {
  try {
    const { name, email, phone, qualification, specialization, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone, profilePicture },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    const teacher = await Teacher.findOneAndUpdate(
      { user: req.user.id },
      { qualification, specialization },
      { returnDocument: 'after', runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user, teacher }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

exports.changeTeacherPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ======================================================
// NOTICES
// ======================================================

exports.getTeacherNotices = async (req, res) => {
  try {
    const notices = await Notice.find({
      targetRoles: 'teacher',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    })
      .populate('author', 'name')
      .sort({ priority: -1, createdAt: -1 });

    return res.status(200).json({ success: true, data: notices });
  } catch (error) {
    console.error('Get teacher notices error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// TIMETABLE
// ======================================================

exports.getTeacherTimetable = async (req, res) => {
  try {
    const { day } = req.query;
    const query = { 'periods.teacher': req.user.id };
    if (day) query.day = day;

    const timetable = await Timetable.find(query)
      .populate('periods.subject', 'name code')
      .populate('periods.teacher', 'name')
      .sort({ day: 1 });

    return res.status(200).json({ success: true, data: timetable });
  } catch (error) {
    console.error('Get teacher timetable error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// AVAILABLE EXAMS (for teacher) — class+section based
// ======================================================

exports.getAvailableExams = async (req, res) => {
  try {
    const { class: className, section } = req.query;

    const query = {};
    if (className) query.class = className;
    if (section) query.section = section;

    const exams = await Result.find(query)
      .select('examName examDate class section academicYear')
      .sort({ examDate: -1 });

    const unique = new Map();
    exams.forEach(e => {
      const key = `${e.examName}|${e.class}|${e.section}|${e.academicYear}`;
      if (!unique.has(key)) unique.set(key, e);
    });

    return res.status(200).json({
      success: true,
      data: Array.from(unique.values())
    });
  } catch (error) {
    console.error('Get available exams error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ======================================================
// STUDENTS
// ======================================================

exports.getTeacherStudents = async (req, res) => {
  try {
    const { search } = req.query;

    const classSectionList = await buildClassSectionMap(req.user.id);

    if (classSectionList.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          students: [], classes: [],
          totalStudents: 0, totalClasses: 0,
          message: 'No classes assigned'
        }
      });
    }

    const orConditions = classSectionList.map((c) => ({
      class: c.className,
      section: c.section
    }));

    let query = { $or: orConditions };

    if (search) {
      query = {
        $and: [
          { $or: orConditions },
          {
            $or: [
              { rollNumber: { $regex: search, $options: 'i' } },
              { 'user.name': { $regex: search, $options: 'i' } }
            ]
          }
        ]
      };
    }

    const students = await Student.find(query)
      .populate('user', 'name email phone profilePicture username')
      .sort({ class: 1, section: 1, rollNumber: 1 });

    const enhanced = students.map((student) => {
      const classData = classSectionList.find(
        (c) => c.className === student.class && c.section === student.section
      );
      return {
        ...student.toObject(),
        teacherSubjects: classData?.subjects || [],
        totalSubjects: classData?.subjects?.length || 0
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        students: enhanced,
        classes: classSectionList.map((c) => ({
          _id: c._id || `${c.className}-${c.section}`,
          className: c.className,
          section: c.section,
          studentCount: students.filter(
            (s) => s.class === c.className && s.section === c.section
          ).length,
          subjects: c.subjects.map((s) => s.name)
        })),
        totalStudents: students.length,
        totalClasses: classSectionList.length
      }
    });
  } catch (error) {
    console.error('Get teacher students error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ======================================================
// PUBLISH RESULT — Subject-level
// ======================================================

exports.publishResult = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    const teacherSubjects = await Subject.find({
      teacher: req.user.id,
      class: result.class,
      section: result.section,
      isActive: true
    }).select('name');

    if (teacherSubjects.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to publish this result'
      });
    }

    const teacherSubjectNames = teacherSubjects.map(s => s.name);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    let publishedCount = 0;

    result.subjects = (result.subjects || []).map(sub => {
      if (teacherSubjectNames.includes(sub.name)) {
        publishedCount++;
        return {
          ...sub.toObject?.() || sub,
          teacher: sub.teacher || req.user.id,
          published: true,
          publishedBy: req.user.id,
          publishedDate: new Date(),
          editDeadline: deadline
        };
      }
      return sub;
    });

    if (publishedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No marks found for your subjects'
      });
    }

    await result.save();

    return res.status(200).json({
      success: true,
      message: `Published ${publishedCount} subject(s) successfully`,
      data: result
    });
  } catch (error) {
    console.error('Publish result error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};