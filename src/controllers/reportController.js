const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Result = require('../models/Result');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// ==================== SCHOOL INFO ====================

const SCHOOL = {
  name: 'MANSINGHABERH BANISHREE VIDYANIKETAN (H.S.)',
  udise: 'UDISE: 19191304703',
  address1: 'Village: Mansinghaberh, P.O: Pankhai, P.S: Khejuri',
  address2: 'Block: Khejuri-II, Dist: Purba Medinipur, West Bengal - 721431',
  principal: 'Sankhadip Maity'
};

// ==================== HELPER: DRAW SCHOOL HEADER ====================

const drawSchoolHeader = (doc) => {
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor('#1a3a6b')
     .text(SCHOOL.name, { align: 'center' });

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#555555')
     .text(SCHOOL.udise, { align: 'center' });

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#555555')
     .text(SCHOOL.address1, { align: 'center' });

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#555555')
     .text(SCHOOL.address2, { align: 'center' });

  doc.moveDown(0.5);

  doc.lineWidth(2)
     .moveTo(50, doc.y)
     .lineTo(545, doc.y)
     .strokeColor('#1a3a6b')
     .stroke();

  doc.moveDown(0.5);

  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#1a3a6b')
     .text('ACADEMIC REPORT CARD', { align: 'center' });

  doc.moveDown(0.5);
};

// ==================== HELPER: DRAW SCHOOL SEAL ====================

const drawSchoolSeal = (doc, x, y) => {
  doc.save();
  doc.circle(x, y, 40)
     .lineWidth(2)
     .strokeColor('#1a3a6b')
     .stroke();

  doc.circle(x, y, 34)
     .lineWidth(1)
     .strokeColor('#1a3a6b')
     .stroke();

  doc.fontSize(7)
     .font('Helvetica-Bold')
     .fillColor('#1a3a6b')
     .text('SCHOOL', x - 40, y - 22, { width: 80, align: 'center' });

  doc.fontSize(6)
     .font('Helvetica')
     .fillColor('#1a3a6b')
     .text('MANSINGHABERH', x - 40, y - 10, { width: 80, align: 'center' });

  doc.fontSize(6)
     .font('Helvetica')
     .fillColor('#1a3a6b')
     .text('BANISHREE', x - 40, y - 1, { width: 80, align: 'center' });

  doc.fontSize(6)
     .font('Helvetica')
     .fillColor('#1a3a6b')
     .text('VIDYANIKETAN', x - 40, y + 8, { width: 80, align: 'center' });

  doc.fontSize(6)
     .font('Helvetica-Bold')
     .fillColor('#1a3a6b')
     .text('ESTD 1968', x - 40, y + 18, { width: 80, align: 'center' });

  doc.restore();
};

// ==================== GENERATE REPORT CARD PDF ====================

exports.generateReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examName, academicYear } = req.query;

    const student = await Student.findById(studentId).populate('user', 'name email');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (req.user.role === 'parent') {
      const Parent = require('../models/Parent');
      const parent = await Parent.findOne({ user: req.user.id });
      if (!parent || !parent.children.includes(studentId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this student\'s report card'
        });
      }
    }

    let query = { student: studentId };
    if (examName) query.examName = examName;
    if (academicYear) query.academicYear = academicYear;

    const results = await Result.find(query).sort({ examDate: -1 });
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No results found for this student'
      });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      layout: 'portrait'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-card-${student.rollNumber}-${Date.now()}.pdf`);

    doc.pipe(res);

    results.forEach((result, index) => {
      if (index > 0) {
        doc.addPage();
      }

      drawSchoolHeader(doc);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#1a3a6b')
         .text(`Academic Year: ${result.academicYear || student.academicYear || '2024-2025'}`, { align: 'center' });

      doc.moveDown(0.5);

      // Student Info Box
      const infoTop = doc.y;
      doc.rect(50, infoTop, 495, 70)
         .lineWidth(1)
         .strokeColor('#1a3a6b')
         .stroke();

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#2c3e50');

      doc.text('Student Name :', 60, infoTop + 8, { continued: true })
         .font('Helvetica-Bold')
         .text(` ${student.user?.name || 'N/A'}`);

      doc.font('Helvetica')
         .text('Roll Number :', 60, infoTop + 24, { continued: true })
         .font('Helvetica-Bold')
         .text(` ${student.rollNumber || 'N/A'}`);

      doc.font('Helvetica')
         .text('Class         :', 60, infoTop + 40, { continued: true })
         .font('Helvetica-Bold')
         .text(` ${student.class} - ${student.section}`);

      doc.font('Helvetica')
         .text('Exam Name  :', 320, infoTop + 8, { continued: true })
         .font('Helvetica-Bold')
         .text(` ${result.examName}`);

      doc.font('Helvetica')
         .text('Exam Date   :', 320, infoTop + 24, { continued: true })
         .font('Helvetica-Bold')
         .text(` ${new Date(result.examDate).toLocaleDateString('en-IN')}`);

      doc.moveDown(4);

      // Subject Table
      const tableTop = doc.y;
      const tableX = 50;
      const colWidths = [40, 180, 90, 90, 95];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);

      // Header
      doc.rect(tableX, tableTop, tableWidth, 24)
         .fillColor('#1a3a6b')
         .fill();

      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica-Bold');

      let hx = tableX;
      const headers = ['SL', 'Subject', 'Full Marks', 'Obtained', 'Grade'];
      headers.forEach((h, i) => {
        doc.text(h, hx + 5, tableTop + 7, { width: colWidths[i] - 10, align: i === 1 ? 'left' : 'center' });
        hx += colWidths[i];
      });

      let y = tableTop + 24;

      result.subjects.forEach((subject, idx) => {
        if (idx % 2 === 0) {
          doc.rect(tableX, y, tableWidth, 22)
             .fillColor('#f0f4fa')
             .fill();
        }

        doc.fillColor('#2c3e50')
           .fontSize(9)
           .font('Helvetica');

        let cx = tableX;
        const rowData = [
          (idx + 1).toString(),
          subject.name || 'N/A',
          (subject.totalMarks || 0).toString(),
          (subject.marksObtained || 0).toString(),
          subject.grade || 'N/A'
        ];

        rowData.forEach((val, i) => {
          if (i === 4) {
            const gradeColor =
              subject.grade === 'A+' || subject.grade === 'A' ? '#1e8449' :
              subject.grade === 'B+' || subject.grade === 'B' ? '#2874a6' :
              subject.grade === 'C+' || subject.grade === 'C' ? '#b9770e' :
              subject.grade === 'D' ? '#ca6f1e' : '#c0392b';
            doc.fillColor(gradeColor).font('Helvetica-Bold');
          } else {
            doc.fillColor('#2c3e50').font('Helvetica');
          }
          doc.text(val, cx + 5, y + 6, { width: colWidths[i] - 10, align: i === 1 ? 'left' : 'center' });
          cx += colWidths[i];
        });

        y += 22;
      });

      // Table border
      doc.rect(tableX, tableTop, tableWidth, y - tableTop)
         .lineWidth(1)
         .strokeColor('#1a3a6b')
         .stroke();

      y += 10;

      // Summary Box
      const passFail = (result.percentage || 0) >= 33 ? 'PASS' : 'FAIL';
      const passColor = passFail === 'PASS' ? '#1e8449' : '#c0392b';

      doc.rect(50, y, 495, 70)
         .lineWidth(1)
         .strokeColor('#1a3a6b')
         .stroke();

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#1a3a6b');

      doc.text(`Total Marks: ${result.totalMarks || 0}`, 60, y + 10);
      doc.text(`Percentage: ${result.percentage || 0}%`, 60, y + 30);

      doc.text(`Grade: ${result.grade || 'N/A'}`, 300, y + 10);
      doc.fillColor(passColor)
         .text(`Result: ${passFail}`, 300, y + 30);

      y += 85;

      // Signatures
      doc.fillColor('#1a3a6b');
      drawSchoolSeal(doc, 120, y + 30);

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#1a3a6b')
         .text(SCHOOL.principal, 300, y + 20, { width: 220, align: 'center' });

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#555555')
         .text('Principal', 300, y + 36, { width: 220, align: 'center' });

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#555555')
         .text(
           `Issue Date: ${result.publishedDate
             ? new Date(result.publishedDate).toLocaleDateString('en-IN')
             : new Date().toLocaleDateString('en-IN')}`,
           50,
           y + 90,
           { align: 'center', width: 495 }
         );

      // Footer
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#999999')
         .text(
           'This is a system generated report card.',
           50,
           doc.page.height - 40,
           { align: 'center', width: 495 }
         );
    });

    doc.end();
  } catch (error) {
    console.error('Report card generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate report card'
      });
    }
  }
};

// ==================== GENERATE REPORT CARD EXCEL ====================

exports.generateReportCardExcel = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId).populate('user', 'name email');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (req.user.role === 'parent') {
      const Parent = require('../models/Parent');
      const parent = await Parent.findOne({ user: req.user.id });
      if (!parent || !parent.children.includes(studentId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this student\'s report card'
        });
      }
    }

    const results = await Result.find({ student: studentId }).sort({ examDate: -1 });
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No results found for this student'
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = SCHOOL.name;
    workbook.created = new Date();

    const infoSheet = workbook.addWorksheet('School Info');
    infoSheet.addRow([SCHOOL.name]);
    infoSheet.addRow([SCHOOL.udise]);
    infoSheet.addRow([SCHOOL.address1]);
    infoSheet.addRow([SCHOOL.address2]);
    infoSheet.addRow([]);
    infoSheet.addRow(['Student Report Card']);
    infoSheet.addRow([]);
    infoSheet.addRow(['Student Name:', student.user?.name || 'N/A']);
    infoSheet.addRow(['Roll Number:', student.rollNumber || 'N/A']);
    infoSheet.addRow(['Class:', `${student.class}-${student.section}`]);
    infoSheet.addRow(['Academic Year:', student.academicYear || '2024-2025']);
    infoSheet.addRow(['Generated On:', new Date().toLocaleString()]);
    infoSheet.addRow(['Principal:', SCHOOL.principal]);

    const resultsSheet = workbook.addWorksheet('Results');

    results.forEach((result) => {
      resultsSheet.addRow([`${result.examName} - ${new Date(result.examDate).toLocaleDateString()}`]);
      resultsSheet.addRow(['Subject', 'Marks Obtained', 'Total Marks', 'Grade', 'Remarks']);

      result.subjects.forEach(subject => {
        resultsSheet.addRow([
          subject.name,
          subject.marksObtained,
          subject.totalMarks,
          subject.grade || 'N/A',
          subject.remarks || ''
        ]);
      });

      resultsSheet.addRow([]);
      resultsSheet.addRow(['Total:', result.totalMarks]);
      resultsSheet.addRow(['Percentage:', `${result.percentage}%`]);
      resultsSheet.addRow(['Grade:', result.grade]);
      resultsSheet.addRow(['Result:', (result.percentage || 0) >= 33 ? 'PASS' : 'FAIL']);
      resultsSheet.addRow(['Issue Date:', result.publishedDate
        ? new Date(result.publishedDate).toLocaleDateString()
        : new Date().toLocaleDateString()]);
      resultsSheet.addRow(['-------------------']);
      resultsSheet.addRow([]);
    });

    resultsSheet.getRow(1).font = { bold: true, size: 14 };
    resultsSheet.getRow(2).font = { bold: true, size: 12 };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report-card-${student.rollNumber}-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate Excel report'
      });
    }
  }
};

// ==================== GENERATE CLASS REPORT ====================

exports.generateClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { examName } = req.query;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    }).populate('user', 'name');

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this class'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Class Report');

    worksheet.addRow([SCHOOL.name]);
    worksheet.addRow([`Class Report - ${classData.className}-${classData.section}`]);
    worksheet.addRow([`Generated On: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    const headers = ['Roll No', 'Student Name', 'Total Marks', 'Percentage', 'Grade'];
    worksheet.addRow(headers);

    for (let student of students) {
      let query = { student: student._id };
      if (examName) query.examName = examName;

      const results = await Result.find(query).sort({ examDate: -1 });
      if (results.length > 0) {
        const latestResult = results[0];
        worksheet.addRow([
          student.rollNumber,
          student.user.name,
          latestResult.totalMarks || 0,
          latestResult.percentage || 0,
          latestResult.grade || 'N/A'
        ]);
      } else {
        worksheet.addRow([
          student.rollNumber,
          student.user.name,
          'N/A',
          'N/A',
          'N/A'
        ]);
      }
    }

    worksheet.getRow(4).font = { bold: true };
    worksheet.columns.forEach(col => {
      col.width = 20;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=class-report-${classData.className}-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Class report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate class report'
      });
    }
  }
};

// ==================== GENERATE ATTENDANCE REPORT ====================

exports.generateAttendanceReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    if (req.user.role === 'teacher') {
      if (classData.classTeacher.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this class report'
        });
      }
    }

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    }).populate('user', 'name');

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this class'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    worksheet.addRow([SCHOOL.name]);
    worksheet.addRow([`Attendance Report - ${classData.className}-${classData.section}`]);
    worksheet.addRow([`Month: ${month || 'All'}, Year: ${year || 'All'}`]);
    worksheet.addRow([`Generated On: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    worksheet.addRow(['Roll No', 'Student Name', 'Present', 'Absent', 'Late', 'Total Days', 'Percentage']);

    for (let student of students) {
      let query = { student: student._id };
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        query.date = { $gte: startDate, $lte: endDate };
      }

      const attendance = await Attendance.find(query);
      const present = attendance.filter(a => a.status === 'Present').length;
      const absent = attendance.filter(a => a.status === 'Absent').length;
      const late = attendance.filter(a => a.status === 'Late').length;
      const total = attendance.length;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

      worksheet.addRow([
        student.rollNumber,
        student.user.name,
        present,
        absent,
        late,
        total,
        `${percentage}%`
      ]);
    }

    worksheet.getRow(5).font = { bold: true };
    worksheet.columns.forEach(col => {
      col.width = 18;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${classData.className}-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Attendance report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate attendance report'
      });
    }
  }
};

// ==================== GENERATE TEACHER REPORT ====================

exports.generateTeacherReport = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findById(teacherId).populate('user', 'name email');
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const classes = await Class.find({
      classTeacher: teacherId,
      isActive: true
    });

    if (classes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No classes found for this teacher'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teacher Report');

    worksheet.addRow([SCHOOL.name]);
    worksheet.addRow([`Teacher Report - ${teacher.user.name}`]);
    worksheet.addRow([`Employee ID: ${teacher.employeeId}`]);
    worksheet.addRow([`Qualification: ${teacher.qualification || 'N/A'}`]);
    worksheet.addRow([`Specialization: ${teacher.specialization || 'N/A'}`]);
    worksheet.addRow([`Generated On: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    worksheet.addRow(['Class', 'Section', 'Total Students', 'Subjects']);

    for (let cls of classes) {
      const studentCount = await Student.countDocuments({
        class: cls.className,
        section: cls.section
      });

      const subjectNames = cls.subjects?.map(s => s.name).join(', ') || 'None';

      worksheet.addRow([
        cls.className,
        cls.section,
        studentCount,
        subjectNames
      ]);
    }

    worksheet.getRow(7).font = { bold: true };
    worksheet.columns.forEach(col => {
      col.width = 20;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=teacher-report-${teacher.employeeId}-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Teacher report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate teacher report'
      });
    }
  }
};

// ==================== DOWNLOAD BULK REPORTS ====================

exports.downloadBulkReport = async (req, res) => {
  try {
    const { classId, examName } = req.body;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const students = await Student.find({
      class: classData.className,
      section: classData.section
    }).populate('user', 'name');

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this class'
      });
    }

    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pdfFiles = [];

    for (let student of students) {
      const pdfPath = path.join(tempDir, `${student.rollNumber}-report-card.pdf`);
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      drawSchoolHeader(doc);

      doc.fontSize(12).font('Helvetica').text(`Student: ${student.user.name}`);
      doc.text(`Roll No: ${student.rollNumber}`);
      doc.text(`Class: ${student.class}-${student.section}`);
      doc.moveDown();

      let query = { student: student._id };
      if (examName) query.examName = examName;

      const results = await Result.find(query).sort({ examDate: -1 });

      if (results.length > 0) {
        const result = results[0];
        doc.text(`Exam: ${result.examName}`);
        doc.text(`Total Marks: ${result.totalMarks}`);
        doc.text(`Percentage: ${result.percentage}%`);
        doc.text(`Grade: ${result.grade}`);
        doc.text(`Result: ${(result.percentage || 0) >= 33 ? 'PASS' : 'FAIL'}`);
        doc.text(
          `Issue Date: ${result.publishedDate
            ? new Date(result.publishedDate).toLocaleDateString('en-IN')
            : new Date().toLocaleDateString('en-IN')}`
        );
      } else {
        doc.text('No results found');
      }

      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica-Bold').text(SCHOOL.principal, { align: 'right' });
      doc.fontSize(8).font('Helvetica').text('Principal', { align: 'right' });

      doc.end();

      await new Promise((resolve) => writeStream.on('finish', resolve));
      pdfFiles.push(pdfPath);
    }

    const zipPath = path.join(tempDir, `bulk-reports-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, `bulk-reports-${classData.className}-${Date.now()}.zip`, () => {
        pdfFiles.forEach(file => fs.unlink(file, () => {}));
        fs.unlink(zipPath, () => {});
      });
    });

    archive.pipe(output);
    pdfFiles.forEach(file => {
      archive.file(file, { name: path.basename(file) });
    });
    archive.finalize();

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate bulk reports'
      });
    }
  }
};