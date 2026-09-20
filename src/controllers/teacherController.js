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

  // --------------------------------------------------
  // 1. Subjects stored in Teacher model
  // Teacher.subjects[].subjectId
  // --------------------------------------------------

  if (
    teacher &&
    Array.isArray(teacher.subjects)
  ) {
    teacher.subjects.forEach((item) => {
      if (
        item &&
        item.subjectId &&
        item.isActive !== false
      ) {
        const subject = item.subjectId;

        const subjectId =
          subject._id || subject;

        if (subjectId) {
          subjectMap.set(
            subjectId.toString(),
            {
              _id: subjectId,
              name:
                subject.name ||
                item.name ||
                'Subject',
              code:
                subject.code ||
                item.code ||
                '',
              description:
                subject.description || '',
              class:
                subject.class || '',
              section:
                subject.section || ''
            }
          );
        }
      }
    });
  }

  // --------------------------------------------------
  // 2. Subjects stored directly in Subject collection
  // Subject.teacher = User ID
  // --------------------------------------------------

  const directSubjects = await Subject.find({
    teacher: userId,
    isActive: true
  }).select(
    '_id name code description class section academicYear'
  );

  directSubjects.forEach((subject) => {
    subjectMap.set(
      subject._id.toString(),
      {
        _id: subject._id,
        name: subject.name,
        code: subject.code || '',
        description:
          subject.description || '',
        class: subject.class || '',
        section: subject.section || '',
        academicYear:
          subject.academicYear || ''
      }
    );
  });

  return Array.from(
    subjectMap.values()
  );
};

// ======================================================
// HELPER: GET SUBJECTS FOR SPECIFIC CLASS
// ======================================================

const getSubjectsForClass = (
  cls,
  teacherSubjects
) => {
  const subjectMap = new Map();

  // --------------------------------------------------
  // 1. Subjects stored inside Class.subjects
  // --------------------------------------------------

  const classSubjects =
    Array.isArray(cls.subjects)
      ? cls.subjects.filter(
          (item) =>
            item &&
            item.subject &&
            item.isActive !== false
        )
      : [];

  classSubjects.forEach((item) => {
    const subject =
      item.subject;

    const subjectId =
      subject?._id ||
      subject;

    if (!subjectId) {
      return;
    }

    subjectMap.set(
      subjectId.toString(),
      {
        _id: subjectId,

        name:
          subject?.name ||
          item.name ||
          'Subject',

        code:
          subject?.code ||
          item.code ||
          '',

        description:
          subject?.description ||
          ''
      }
    );
  });

  // --------------------------------------------------
  // 2. Teacher assigned subjects
  // --------------------------------------------------

  teacherSubjects.forEach(
    (subject) => {
      const subjectClass =
        String(
          subject.class || ''
        ).trim();

      const subjectSection =
        String(
          subject.section || ''
        ).trim()
        .toUpperCase();

      const className =
        String(
          cls.className || ''
        ).trim();

      const section =
        String(
          cls.section || ''
        ).trim()
        .toUpperCase();

      if (
        subjectClass ===
          className &&
        subjectSection ===
          section
      ) {
        subjectMap.set(
          subject._id.toString(),
          {
            _id: subject._id,
            name:
              subject.name ||
              'Subject',
            code:
              subject.code || '',
            description:
              subject.description ||
              ''
          }
        );
      }
    }
  );

  return Array.from(
    subjectMap.values()
  );
};

// ======================================================
// DASHBOARD
// ======================================================

// @desc    Get teacher dashboard data
// @route   GET /api/teacher/dashboard
// @access  Private (Teacher only)

exports.getTeacherDashboard =
  async (req, res) => {
    try {
      // ------------------------------------------------
      // FIND TEACHER PROFILE
      // ------------------------------------------------

      const teacher =
        await Teacher.findOne({
          user: req.user.id
        }).populate({
          path:
            'subjects.subjectId',
          select:
            'name code description class section academicYear'
        });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message:
            'Teacher profile not found'
        });
      }

      // ------------------------------------------------
      // GET ASSIGNED CLASSES
      // ------------------------------------------------

      const classes =
        await Class.find({
          classTeacher:
            req.user.id,

          isActive: true
        })
          .populate(
            'classTeacher',
            'name email'
          )
          .populate(
            'subjects.subject',
            'name code description class section'
          )
          .populate(
            'subjects.teacher',
            'name email'
          );

      // ------------------------------------------------
      // GET ALL TEACHER SUBJECTS
      // ------------------------------------------------

      const teacherSubjects =
        await getTeacherSubjects(
          teacher,
          req.user.id
        );

      // ------------------------------------------------
      // ADD STUDENT + SUBJECT COUNTS
      // ------------------------------------------------

      const classesWithCount =
        await Promise.all(
          classes.map(
            async (cls) => {
              // Student count
              const studentCount =
                await Student.countDocuments(
                  {
                    class:
                      cls.className,

                    section:
                      cls.section
                  }
                );

              // Subjects for this class
              const subjects =
                getSubjectsForClass(
                  cls,
                  teacherSubjects
                );

              return {
                ...cls.toObject(),

                studentCount,

                subjectCount:
                  subjects.length,

                subjects
              };
            }
          )
        );

      // ------------------------------------------------
      // TODAY'S TIMETABLE
      // ------------------------------------------------

      const today =
        new Date();

      const todayName =
        [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday'
        ][today.getDay()];

      const todayTimetable =
        await Timetable.find({
          'periods.teacher':
            req.user.id,

          day: todayName
        })
          .populate(
            'periods.subject',
            'name code'
          )
          .populate(
            'periods.teacher',
            'name'
          );

      // ------------------------------------------------
      // TOTAL STUDENTS
      // ------------------------------------------------

      let totalStudents = 0;

      for (
        const cls of classes
      ) {
        const count =
          await Student.countDocuments(
            {
              class:
                cls.className,

              section:
                cls.section
            }
          );

        totalStudents += count;
      }

      // ------------------------------------------------
      // TODAY'S ATTENDANCE
      // ------------------------------------------------

      const todayStart =
        new Date();

      todayStart.setHours(
        0,
        0,
        0,
        0
      );

      const todayEnd =
        new Date();

      todayEnd.setHours(
        23,
        59,
        59,
        999
      );

      const todayAttendance =
        await Attendance.find({
          markedBy:
            req.user.id,

          date: {
            $gte: todayStart,
            $lte: todayEnd
          }
        });

      // ------------------------------------------------
      // RECENT NOTICES
      // ------------------------------------------------

      const notices =
        await Notice.find({
          targetRoles: 'teacher',

          isActive: true,

          $or: [
            {
              expiresAt: {
                $exists: false
              }
            },

            {
              expiresAt: {
                $gt: new Date()
              }
            }
          ]
        })
          .sort({
            createdAt: -1
          })
          .limit(5);

      // ------------------------------------------------
      // RESPONSE
      // ------------------------------------------------

      return res.status(200).json({
        success: true,

        data: {
          teacher: {
            name:
              req.user.name,

            employeeId:
              teacher.employeeId,

            qualification:
              teacher.qualification ||
              '',

            specialization:
              teacher.specialization ||
              ''
          },

          statistics: {
            totalClasses:
              classesWithCount.length,

            totalStudents,

            todayClasses:
              todayTimetable.length,

            todayAttendance:
              todayAttendance.length
          },

          classes:
            classesWithCount,

          todayTimetable,

          recentNotices:
            notices
        }
      });
    } catch (error) {
      console.error(
        'Dashboard error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// CLASS MANAGEMENT
// ======================================================

// @desc    Get assigned classes
// @route   GET /api/teacher/classes
// @access  Private (Teacher only)

exports.getAssignedClasses =
  async (req, res) => {
    try {
      // ------------------------------------------------
      // FIND TEACHER
      // ------------------------------------------------

      const teacher =
        await Teacher.findOne({
          user: req.user.id
        }).populate({
          path:
            'subjects.subjectId',
          select:
            'name code description class section academicYear'
        });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message:
            'Teacher profile not found'
        });
      }

      // ------------------------------------------------
      // GET CLASSES
      // ------------------------------------------------

      const classes =
        await Class.find({
          classTeacher:
            req.user.id,

          isActive: true
        })
          .populate(
            'classTeacher',
            'name email'
          )
          .populate(
            'subjects.subject',
            'name code description class section'
          )
          .populate(
            'subjects.teacher',
            'name email'
          );

      // ------------------------------------------------
      // GET TEACHER SUBJECTS
      // ------------------------------------------------

      const teacherSubjects =
        await getTeacherSubjects(
          teacher,
          req.user.id
        );

      // ------------------------------------------------
      // PROCESS CLASSES
      // ------------------------------------------------

      const classesWithCount =
        await Promise.all(
          classes.map(
            async (cls) => {
              // Student count
              const studentCount =
                await Student.countDocuments(
                  {
                    class:
                      cls.className,

                    section:
                      cls.section
                  }
                );

              // Subjects
              const subjects =
                getSubjectsForClass(
                  cls,
                  teacherSubjects
                );

              return {
                ...cls.toObject(),

                studentCount,

                subjectCount:
                  subjects.length,

                subjects
              };
            }
          )
        );

      return res.status(200).json({
        success: true,
        data:
          classesWithCount
      });
    } catch (error) {
      console.error(
        'Get assigned classes error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// GET CLASS STUDENTS
// ======================================================

// @desc    Get students in a class
// @route   GET /api/teacher/classes/:classId/students
// @access  Private (Teacher only)

exports.getClassStudents =
  async (req, res) => {
    try {
      const classData =
        await Class.findById(
          req.params.classId
        );

      if (!classData) {
        return res.status(404).json({
          success: false,
          message:
            'Class not found'
        });
      }

      if (
        !classData.classTeacher ||
        classData.classTeacher.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not assigned to this class'
        });
      }

      const students =
        await Student.find({
          class:
            classData.className,

          section:
            classData.section
        })
          .populate(
            'user',
            'name email phone profilePicture'
          )
          .sort({
            rollNumber: 1
          });

      return res.status(200).json({
        success: true,

        data: {
          class:
            classData,

          students
        }
      });
    } catch (error) {
      console.error(
        'Get class students error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// ATTENDANCE
// ======================================================

// @desc    Mark student attendance
// @route   POST /api/teacher/attendance
// @access  Private (Teacher only)

exports.markStudentAttendance =
  async (req, res) => {
    try {
      const {
        studentId,
        class: className,
        section,
        status,
        remarks,
        latitude,
        longitude
      } = req.body;

      const student =
        await Student.findById(
          studentId
        );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            'Student not found'
        });
      }

      const classData =
        await Class.findOne({
          className:
            className ||
            student.class,

          section:
            section ||
            student.section,

          classTeacher:
            req.user.id
        });

      if (!classData) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized to mark attendance for this class'
        });
      }

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const tomorrow =
        new Date(today);

      tomorrow.setDate(
        tomorrow.getDate() + 1
      );

      const existingAttendance =
        await Attendance.findOne({
          student:
            studentId,

          date: {
            $gte: today,
            $lt: tomorrow
          }
        });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message:
            'Attendance already marked for today'
        });
      }

      const attendance =
        await Attendance.create({
          student:
            studentId,

          user:
            student.user,

          class:
            className ||
            student.class,

          section:
            section ||
            student.section,

          status:
            status ||
            'Present',

          markedBy:
            req.user.id,

          checkInTime:
            new Date(),

          location: {
            latitude:
              latitude || null,

            longitude:
              longitude || null
          },

          remarks:
            remarks || ''
        });

      return res.status(201).json({
        success: true,

        message:
          'Attendance marked successfully',

        data:
          attendance
      });
    } catch (error) {
      console.error(
        'Mark attendance error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// GET CLASS ATTENDANCE
// ======================================================

// @desc    Get class attendance
// @route   GET /api/teacher/attendance/:classId
// @access  Private (Teacher only)

exports.getClassAttendance =
  async (req, res) => {
    try {
      const {
        classId
      } = req.params;

      const {
        date
      } = req.query;

      const classData =
        await Class.findById(
          classId
        );

      if (!classData) {
        return res.status(404).json({
          success: false,
          message:
            'Class not found'
        });
      }

      if (
        !classData.classTeacher ||
        classData.classTeacher.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not assigned to this class'
        });
      }

      const students =
        await Student.find({
          class:
            classData.className,

          section:
            classData.section
        }).populate(
          'user',
          'name'
        );

      let queryDate =
        date
          ? new Date(date)
          : new Date();

      queryDate.setHours(
        0,
        0,
        0,
        0
      );

      const nextDate =
        new Date(queryDate);

      nextDate.setDate(
        nextDate.getDate() + 1
      );

      const attendanceRecords =
        await Attendance.find({
          student: {
            $in: students.map(
              (s) => s._id
            )
          },

          date: {
            $gte: queryDate,
            $lt: nextDate
          }
        });

      const attendanceData =
        students.map(
          (student) => {
            const record =
              attendanceRecords.find(
                (a) =>
                  a.student.toString() ===
                  student._id.toString()
              );

            return {
              student: {
                _id:
                  student._id,

                rollNumber:
                  student.rollNumber,

                name:
                  student.user?.name ||
                  'Unknown'
              },

              status:
                record?.status ||
                'Absent',

              checkInTime:
                record?.checkInTime ||
                null,

              location:
                record?.location ||
                null,

              remarks:
                record?.remarks ||
                ''
            };
          }
        );

      const present =
        attendanceData.filter(
          (a) =>
            a.status ===
            'Present'
        ).length;

      const absent =
        attendanceData.filter(
          (a) =>
            a.status ===
            'Absent'
        ).length;

      const late =
        attendanceData.filter(
          (a) =>
            a.status ===
            'Late'
        ).length;

      return res.status(200).json({
        success: true,

        data: {
          class:
            classData,

          date:
            queryDate,

          summary: {
            total:
              students.length,

            present,

            absent,

            late,

            percentage:
              students.length > 0
                ? (
                    (present /
                      students.length) *
                    100
                  ).toFixed(2)
                : 0
          },

          records:
            attendanceData
        }
      });
    } catch (error) {
      console.error(
        'Get class attendance error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// ======================================================
// ATTENDANCE REPORT
// ======================================================

// @desc    Get attendance report
// @route   GET /api/teacher/attendance/report/:classId
// @access  Private (Teacher only)

exports.getAttendanceReport =
  async (req, res) => {
    try {
      const {
        classId
      } = req.params;

      const {
        month,
        year
      } = req.query;

      const classData =
        await Class.findById(
          classId
        );

      if (!classData) {
        return res.status(404).json({
          success: false,
          message:
            'Class not found'
        });
      }

      if (
        !classData.classTeacher ||
        classData.classTeacher.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not assigned to this class'
        });
      }

      const students =
        await Student.find({
          class:
            classData.className,

          section:
            classData.section
        });

      let startDate;
      let endDate;

      if (month && year) {
        startDate =
          new Date(
            Number(year),
            Number(month) - 1,
            1
          );

        endDate =
          new Date(
            Number(year),
            Number(month),
            0
          );

        endDate.setHours(
          23,
          59,
          59,
          999
        );
      } else {
        const now =
          new Date();

        startDate =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );

        endDate =
          new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          );

        endDate.setHours(
          23,
          59,
          59,
          999
        );
      }

      const attendanceRecords =
        await Attendance.find({
          student: {
            $in: students.map(
              (s) => s._id
            )
          },

          date: {
            $gte: startDate,
            $lte: endDate
          }
        });

      const dailyReport = {};

      for (
        let d =
          new Date(startDate);

        d <= endDate;

        d.setDate(
          d.getDate() + 1
        )
      ) {
        const dateStr =
          d.toISOString()
            .split('T')[0];

        dailyReport[dateStr] = {
          date:
            dateStr,

          present: 0,

          absent: 0,

          late: 0
        };
      }

      attendanceRecords.forEach(
        (record) => {
          const dateStr =
            record.date
              .toISOString()
              .split('T')[0];

          const status =
            record.status
              ?.toLowerCase();

          if (
            dailyReport[dateStr] &&
            dailyReport[dateStr][
              status
            ] !== undefined
          ) {
            dailyReport[dateStr][
              status
            ]++;
          }
        }
      );

      const studentReport =
        students.map(
          (student) => {
            const records =
              attendanceRecords.filter(
                (a) =>
                  a.student.toString() ===
                  student._id.toString()
              );

            const present =
              records.filter(
                (a) =>
                  a.status ===
                  'Present'
              ).length;

            const total =
              records.length;

            return {
              student: {
                _id:
                  student._id,

                rollNumber:
                  student.rollNumber,

                name:
                  student.user?.name ||
                  'Unknown'
              },

              present,

              absent:
                total - present,

              total,

              percentage:
                total > 0
                  ? (
                      (present /
                        total) *
                      100
                    ).toFixed(2)
                  : 0
            };
          }
        );

      return res.status(200).json({
        success: true,

        data: {
          class:
            classData,

          period: {
            start:
              startDate,

            end:
              endDate
          },

          dailyReport:
            Object.values(
              dailyReport
            ),

          studentReport,

          summary: {
            totalStudents:
              students.length,

            totalDays:
              Object.keys(
                dailyReport
              ).length
          }
        }
      });
    } catch (error) {
      console.error(
        'Get attendance report error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// ======================================================
// MARKS / GRADES
// ======================================================

// @desc    Enter marks
// @route   POST /api/teacher/marks
// @access  Private (Teacher only)

exports.enterMarks =
  async (req, res) => {
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

      const student =
        await Student.findById(
          studentId
        );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            'Student not found'
        });
      }

      const classData =
        await Class.findOne({
          className:
            className ||
            student.class,

          section:
            section ||
            student.section,

          classTeacher:
            req.user.id
        });

      if (!classData) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized to enter marks for this class'
        });
      }

      let totalMarks = 0;

      let totalObtained = 0;

      (subjects || []).forEach(
        (sub) => {
          totalMarks +=
            Number(
              sub.totalMarks
            ) || 100;

          totalObtained +=
            Number(
              sub.marksObtained
            ) || 0;
        }
      );

      const percentage =
        totalMarks > 0
          ? (totalObtained /
              totalMarks) *
            100
          : 0;

      let grade = 'F';

      if (percentage >= 90)
        grade = 'A+';
      else if (percentage >= 80)
        grade = 'A';
      else if (percentage >= 70)
        grade = 'B+';
      else if (percentage >= 60)
        grade = 'B';
      else if (percentage >= 50)
        grade = 'C+';
      else if (percentage >= 40)
        grade = 'C';
      else if (percentage >= 33)
        grade = 'D';

      const result =
        await Result.findOneAndUpdate(
          {
            student:
              studentId,

            examName,

            class:
              className ||
              student.class,

            section:
              section ||
              student.section,

            academicYear:
              academicYear ||
              new Date()
                .getFullYear()
                .toString()
          },

          {
            student:
              studentId,

            class:
              className ||
              student.class,

            section:
              section ||
              student.section,

            examName,

            examDate:
              examDate ||
              new Date(),

            subjects:
              subjects || [],

            totalMarks:
              totalObtained,

            percentage:
              parseFloat(
                percentage.toFixed(2)
              ),

            grade,

            academicYear:
              academicYear ||
              new Date()
                .getFullYear()
                .toString(),

            published:
              false
          },

         { returnDocument: "after", runValidators: true }
        );

      return res.status(201).json({
        success: true,

        message:
          'Marks entered successfully',

        data:
          result
      });
    } catch (error) {
      console.error(
        'Enter marks error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// GET CLASS MARKS
// ======================================================

// @desc    Get class marks
// @route   GET /api/teacher/marks/:classId
// @access  Private (Teacher only)

exports.getClassMarks =
  async (req, res) => {
    try {
      const {
        classId
      } = req.params;

      const {
        examName
      } = req.query;

      const classData =
        await Class.findById(
          classId
        );

      if (!classData) {
        return res.status(404).json({
          success: false,
          message:
            'Class not found'
        });
      }

      if (
        !classData.classTeacher ||
        classData.classTeacher.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not assigned to this class'
        });
      }

      let query = {
        class:
          classData.className,

        section:
          classData.section
      };

      if (examName) {
        query.examName =
          examName;
      }

      const results =
        await Result.find(
          query
        )
          .populate(
            'student',
            'rollNumber'
          )
          .sort({
            'student.rollNumber':
              1
          });

      const groupedResults =
        results.reduce(
          (
            acc,
            result
          ) => {
            if (
              !acc[
                result.examName
              ]
            ) {
              acc[
                result.examName
              ] = [];
            }

            acc[
              result.examName
            ].push(result);

            return acc;
          },
          {}
        );

      return res.status(200).json({
        success: true,

        data: {
          class:
            classData,

          exams:
            groupedResults,

          examsList:
            Object.keys(
              groupedResults
            )
        }
      });
    } catch (error) {
      console.error(
        'Get class marks error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// ======================================================
// UPDATE MARKS
// ======================================================

// @desc    Update marks
// @route   PUT /api/teacher/marks/:markId
// @access  Private (Teacher only)

exports.updateMarks =
  async (req, res) => {
    try {
      const {
        subjects,
        totalMarks,
        percentage,
        grade
      } = req.body;

      const result =
        await Result.findById(
          req.params.markId
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          message:
            'Result not found'
        });
      }

      const classData =
        await Class.findOne({
          className:
            result.class,

          section:
            result.section,

          classTeacher:
            req.user.id
        });

      if (!classData) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized to update these marks'
        });
      }

      if (
        subjects !==
        undefined
      ) {
        result.subjects =
          subjects;
      }

      if (
        totalMarks !==
        undefined
      ) {
        result.totalMarks =
          totalMarks;
      }

      if (
        percentage !==
        undefined
      ) {
        result.percentage =
          percentage;
      }

      if (
        grade !==
        undefined
      ) {
        result.grade =
          grade;
      }

      await result.save();

      return res.status(200).json({
        success: true,

        message:
          'Marks updated successfully',

        data:
          result
      });
    } catch (error) {
      console.error(
        'Update marks error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// ======================================================
// GET STUDENT MARKS
// ======================================================

// @desc    Get student marks
// @route   GET /api/teacher/marks/student/:studentId
// @access  Private (Teacher only)

exports.getStudentMarks =
  async (req, res) => {
    try {
      const {
        studentId
      } = req.params;

      const student =
        await Student.findById(
          studentId
        );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            'Student not found'
        });
      }

      const classData =
        await Class.findOne({
          className:
            student.class,

          section:
            student.section,

          classTeacher:
            req.user.id
        });

      if (!classData) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to view this student's marks"
        });
      }

      const results =
        await Result.find({
          student:
            studentId
        }).sort({
          examDate: -1
        });

      return res.status(200).json({
        success: true,

        data: {
          student,

          results
        }
      });
    } catch (error) {
      console.error(
        'Get student marks error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// ======================================================
// STUDY MATERIALS
// ======================================================

// @desc    Upload study material
// @route   POST /api/teacher/materials
// @access  Private (Teacher only)

exports.uploadStudyMaterial =
  async (req, res) => {
    try {
      const {
        title,
        description,
        subject,
        class: className,
        section,
        fileUrl,
        fileType,
        fileSize
      } = req.body;

      const classData =
        await Class.findOne({
          className,

          section,

          classTeacher:
            req.user.id
        });

      if (!classData) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized to upload materials for this class'
        });
      }

      const material =
        await StudyMaterial.create(
          {
            title,

            description,

            subject,

            class:
              className,

            section,

            uploadedBy:
              req.user.id,

            fileUrl,

            fileType,

            fileSize,

            isActive: true
          }
        );

      return res.status(201).json({
        success: true,

        message:
          'Study material uploaded successfully',

        data:
          material
      });
    } catch (error) {
      console.error(
        'Upload study material error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };

// @desc    Get study materials
// @route   GET /api/teacher/materials
// @access  Private (Teacher only)

exports.getStudyMaterials =
  async (req, res) => {
    try {
      const {
        class: className,
        section,
        subject
      } = req.query;

      const query = {
        uploadedBy:
          req.user.id
      };

      if (className) {
        query.class =
          className;
      }

      if (section) {
        query.section =
          section;
      }

      if (subject) {
        query.subject =
          subject;
      }

      const materials =
        await StudyMaterial.find(
          query
        )
          .populate(
            'uploadedBy',
            'name'
          )
          .sort({
            createdAt: -1
          });

      return res.status(200).json({
        success: true,

        data:
          materials
      });
    } catch (error) {
      console.error(
        'Get study materials error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Server error'
      });
    }
  };

// @desc    Delete study material
// @route   DELETE /api/teacher/materials/:id
// @access  Private (Teacher only)

exports.deleteStudyMaterial =
  async (req, res) => {
    try {
      const material =
        await StudyMaterial.findOne({
          _id:
            req.params.id,

          uploadedBy:
            req.user.id
        });

      if (!material) {
        return res.status(404).json({
          success: false,
          message:
            'Material not found or you are not authorized'
        });
      }

      await StudyMaterial.findByIdAndDelete(
        req.params.id
      );

      return res.status(200).json({
        success: true,

        message:
          'Study material deleted successfully'
      });
    } catch (error) {
      console.error(
        'Delete study material error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          'Server error'
      });
    }
  };

// ======================================================
// PROFILE
// ======================================================

// @desc    Update teacher profile
// @route   PUT /api/teacher/profile
// @access  Private (Teacher only)

exports.updateTeacherProfile =
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        qualification,
        specialization,
        profilePicture
      } = req.body;

      const user =
        await User.findByIdAndUpdate(
          req.user.id,

          {
            name,
            email,
            phone,
            profilePicture
          },

         { returnDocument: "after", runValidators: true }
        ).select(
          '-password'
        );

      const teacher =
        await Teacher.findOneAndUpdate(
          {
            user:
              req.user.id
          },

          {
            qualification,
            specialization
          },

          { returnDocument: "after", runValidators: true }
        );

      return res.status(200).json({
        success: true,

        message:
          'Profile updated successfully',

        data: {
          user,

          teacher
        }
      });
    } catch (error) {
      console.error(
        'Update profile error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };

// @desc    Change teacher password
// @route   PUT /api/teacher/change-password
// @access  Private (Teacher only)

exports.changeTeacherPassword =
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword
      } = req.body;

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            'User not found'
        });
      }

      const isPasswordValid =
        await user.comparePassword(
          currentPassword
        );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message:
            'Current password is incorrect'
        });
      }

      user.password =
        newPassword;

      await user.save();

      return res.status(200).json({
        success: true,

        message:
          'Password changed successfully'
      });
    } catch (error) {
      console.error(
        'Change password error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };

// ======================================================
// NOTICES
// ======================================================

// @desc    Get teacher notices
// @route   GET /api/teacher/notices
// @access  Private (Teacher only)

exports.getTeacherNotices =
  async (req, res) => {
    try {
      const notices =
        await Notice.find({
          targetRoles:
            'teacher',

          isActive: true,

          $or: [
            {
              expiresAt: {
                $exists: false
              }
            },

            {
              expiresAt: {
                $gt: new Date()
              }
            }
          ]
        })
          .populate(
            'author',
            'name'
          )
          .sort({
            priority: -1,

            createdAt: -1
          });

      return res.status(200).json({
        success: true,

        data:
          notices
      });
    } catch (error) {
      console.error(
        'Get teacher notices error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          'Server error'
      });
    }
  };

// ======================================================
// TIMETABLE
// ======================================================

// @desc    Get teacher timetable
// @route   GET /api/teacher/timetable
// @access  Private (Teacher only)

exports.getTeacherTimetable =
  async (req, res) => {
    try {
      const {
        day
      } = req.query;

      const query = {
        'periods.teacher':
          req.user.id
      };

      if (day) {
        query.day =
          day;
      }

      const timetable =
        await Timetable.find(
          query
        )
          .populate(
            'periods.subject',
            'name code'
          )
          .populate(
            'periods.teacher',
            'name'
          )
          .sort({
            day: 1
          });

      return res.status(200).json({
        success: true,

        data:
          timetable
      });
    } catch (error) {
      console.error(
        'Get teacher timetable error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          'Server error'
      });
    }
  };

// ======================================================
// STUDENTS
// ======================================================

// @desc    Get all students taught by teacher
// @route   GET /api/teacher/students
// @access  Private (Teacher only)

exports.getTeacherStudents =
  async (req, res) => {
    try {
      const {
        search
      } = req.query;

      const classes =
        await Class.find({
          classTeacher:
            req.user.id,

          isActive: true
        });

      if (
        classes.length === 0
      ) {
        return res.status(200).json({
          success: true,

          data: {
            students: [],

            message:
              'No classes assigned'
          }
        });
      }

      const orConditions =
        classes.map(
          (c) => ({
            class:
              c.className,

            section:
              c.section
          })
        );

      const query = {
        $or:
          orConditions
      };

      const students =
        await Student.find(
          query
        )
          .populate(
            'user',
            'name email phone profilePicture'
          )
          .sort({
            class: 1,

            section: 1,

            rollNumber: 1
          });

      let filteredStudents =
        students;

      if (search) {
        const searchText =
          search.toLowerCase();

        filteredStudents =
          students.filter(
            (student) => {
              const name =
                student.user
                  ?.name ||
                '';

              const roll =
                student.rollNumber ||
                '';

              return (
                name
                  .toLowerCase()
                  .includes(
                    searchText
                  ) ||

                roll
                  .toLowerCase()
                  .includes(
                    searchText
                  )
              );
            }
          );
      }

      return res.status(200).json({
        success: true,

        data:
          filteredStudents
      });
    } catch (error) {
      console.error(
        'Get teacher students error:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Server error'
      });
    }
  };
  // @desc    Get all students taught by teacher with details
// @route   GET /api/teacher/students
// @access  Private (Teacher only)
exports.getTeacherStudents = async (req, res) => {
  try {
    const { search } = req.query;

    // ✅ Get teacher's classes
    const classes = await Class.find({
      classTeacher: req.user.id,
      isActive: true
    }).populate('subjects.subject', 'name code');

    if (classes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          students: [],
          classes: [],
          message: 'No classes assigned'
        }
      });
    }

    // ✅ Get all subjects taught by this teacher
    const subjects = await Subject.find({
      teacher: req.user.id,
      isActive: true
    });

    // ✅ Get students from all assigned classes
    let query = {
      $or: classes.map(c => ({
        class: c.className,
        section: c.section
      }))
    };

    if (search) {
      query.$and = [
        query.$or,
        {
          $or: [
            { rollNumber: { $regex: search, $options: 'i' } },
            { 'user.name': { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    const students = await Student.find(query)
      .populate('user', 'name email phone profilePicture')
      .sort({ class: 1, section: 1, rollNumber: 1 });

    // ✅ Enhance student data with subject info
    const enhancedStudents = students.map(student => {
      // Find which subjects this student has in their class
      const classData = classes.find(c => 
        c.className === student.class && c.section === student.section
      );
      
      // Get subjects for this class
      const classSubjects = classData?.subjects?.map(s => ({
        name: s.subject?.name || s.name || 'N/A',
        code: s.subject?.code || s.code || 'N/A'
      })) || [];

      // Get subjects taught by this teacher for this class
      const teacherSubjects = subjects
        .filter(s => s.class === student.class && s.section === student.section)
        .map(s => ({
          name: s.name,
          code: s.code
        }));

      return {
        ...student.toObject(),
        classSubjects: classSubjects,
        teacherSubjects: teacherSubjects,
        totalSubjects: teacherSubjects.length
      };
    });

    res.status(200).json({
      success: true,
      data: {
        students: enhancedStudents,
        classes: classes.map(c => ({
          _id: c._id,
          className: c.className,
          section: c.section,
          studentCount: students.filter(s => 
            s.class === c.className && s.section === c.section
          ).length,
          subjects: c.subjects?.map(s => s.subject?.name || s.name) || []
        })),
        totalStudents: students.length,
        totalClasses: classes.length
      }
    });
  } catch (error) {
    console.error('Get teacher students error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};