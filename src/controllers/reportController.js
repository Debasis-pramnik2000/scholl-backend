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

// ==================== GENERATE REPORT CARD PDF ====================

// @desc    Generate Report Card PDF
// @route   GET /api/student/report-card/:studentId
// @access  Private (Student/Parent)
exports.generateReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examName, academicYear } = req.query;

    // Get student data
    const student = await Student.findById(studentId).populate('user', 'name email');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // ✅ Check authorization
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

    // Get results
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

    // ✅ Create PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      layout: 'portrait'
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-card-${student.rollNumber}-${Date.now()}.pdf`);
    
    doc.pipe(res);

    // ====== PDF CONTENT ======

    // ✅ School Header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('ABC School', { align: 'center' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text('Excellence in Education Since 1990', { align: 'center' });
    
    doc.moveDown();
    
    // ✅ Decorative Line
    doc.lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .strokeColor('#3498db')
       .stroke();
    doc.moveDown();

    // ✅ Student Information
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Student Information', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#34495e');

    // Left Column
    const infoX = 50;
    let infoY = doc.y;
    
    doc.text('Student Name:', infoX, infoY, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${student.user.name}`);
    
    infoY = doc.y + 5;
    doc.font('Helvetica')
       .text('Roll Number:', infoX, infoY, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${student.rollNumber}`);
    
    infoY = doc.y + 5;
    doc.font('Helvetica')
       .text('Class:', infoX, infoY, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${student.class}-${student.section}`);
    
    infoY = doc.y + 5;
    doc.font('Helvetica')
       .text('Academic Year:', infoX, infoY, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${student.academicYear || '2024-2025'}`);
    
    infoY = doc.y + 5;
    doc.font('Helvetica')
       .text('Generated On:', infoX, infoY, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`);
    
    doc.moveDown(2);

    // ✅ Results Section
    results.forEach((result, index) => {
      // Check if need new page
      if (doc.y > 650) {
        doc.addPage();
      }

      // Exam Header
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#2980b9')
         .text(`${result.examName}`, { underline: true });
      doc.moveDown(0.5);

      // Exam Date
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#7f8c8d')
         .text(`Date: ${new Date(result.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`);
      doc.moveDown(0.5);

      // ✅ Table Headers
      const tableTop = doc.y;
      const columns = ['Subject', 'Marks Obtained', 'Total Marks', 'Grade'];
      const columnWidths = [150, 120, 100, 80];
      const tableX = 50;
      
      // Draw header background
      doc.rect(tableX, tableTop, 500, 25)
         .fillColor('#3498db')
         .fill();
      
      // Draw header text
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#ffffff');
      
      let x = tableX + 10;
      doc.text(columns[0], x, tableTop + 5, { width: columnWidths[0] - 10 });
      x += columnWidths[0];
      doc.text(columns[1], x, tableTop + 5, { width: columnWidths[1] - 10 });
      x += columnWidths[1];
      doc.text(columns[2], x, tableTop + 5, { width: columnWidths[2] - 10 });
      x += columnWidths[2];
      doc.text(columns[3], x, tableTop + 5, { width: columnWidths[3] - 10 });
      
      let y = tableTop + 25;
      
      // Draw rows
      doc.font('Helvetica')
         .fillColor('#2c3e50');
      
      result.subjects.forEach((subject, idx) => {
        // Alternate row color
        if (idx % 2 === 0) {
          doc.rect(tableX, y - 2, 500, 20)
             .fillColor('#ecf0f1')
             .fill();
        }
        
        doc.fillColor('#2c3e50');
        let rowX = tableX + 10;
        doc.text(subject.name, rowX, y, { width: columnWidths[0] - 10 });
        rowX += columnWidths[0];
        doc.text(subject.marksObtained.toString(), rowX, y, { width: columnWidths[1] - 10 });
        rowX += columnWidths[1];
        doc.text(subject.totalMarks.toString(), rowX, y, { width: columnWidths[2] - 10 });
        rowX += columnWidths[2];
        
        // Grade with color
        const gradeColor = subject.grade === 'A+' || subject.grade === 'A' ? '#27ae60' :
                          subject.grade === 'B+' || subject.grade === 'B' ? '#2980b9' :
                          subject.grade === 'C+' || subject.grade === 'C' ? '#f39c12' :
                          subject.grade === 'D' ? '#e67e22' : '#e74c3c';
        
        doc.fillColor(gradeColor)
           .font('Helvetica-Bold')
           .text(subject.grade || 'N/A', rowX, y, { width: columnWidths[3] - 10 });
        doc.fillColor('#2c3e50')
           .font('Helvetica');
        
        y += 20;
      });

      // ✅ Summary
      y += 5;
      doc.rect(tableX, y - 2, 500, 25)
         .fillColor('#f8f9fa')
         .fill();
      
      doc.fillColor('#2c3e50')
         .font('Helvetica-Bold')
         .text('Total:', tableX + 10, y + 2, { continued: true })
         .font('Helvetica')
         .text(` ${result.totalMarks}`);
      
      doc.font('Helvetica-Bold')
         .text('Percentage:', tableX + 250, y + 2, { continued: true })
         .font('Helvetica')
         .text(` ${result.percentage}%`);
      
      doc.font('Helvetica-Bold')
         .text('Grade:', tableX + 400, y + 2, { continued: true })
         .font('Helvetica-Bold')
         .fillColor(result.grade === 'A+' || result.grade === 'A' ? '#27ae60' :
                   result.grade === 'B+' || result.grade === 'B' ? '#2980b9' :
                   result.grade === 'C+' || result.grade === 'C' ? '#f39c12' : '#e74c3c')
         .text(` ${result.grade}`);
      
      doc.fillColor('#2c3e50')
         .font('Helvetica');
      
      doc.moveDown(2);
      
      // Add page break if not last and y is near bottom
      if (index < results.length - 1 && doc.y > 650) {
        doc.addPage();
      }
    });

    // ✅ Footer
    const footerY = doc.page.height - 50;
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#bdc3c7')
       .text('This is a system generated report card.', 50, footerY)
       .text(`Generated on: ${new Date().toLocaleString()}`, 50, footerY + 15);

    doc.end();
  } catch (error) {
    console.error('Report card generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate report card'
    });
  }
};

// ==================== GENERATE REPORT CARD EXCEL ====================

// @desc    Generate Report Card Excel
// @route   GET /api/student/report-card/excel/:studentId
// @access  Private (Student/Parent)
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

    // Check authorization
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

    // ✅ Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ABC School';
    workbook.created = new Date();

    // ✅ School Info Sheet
    const infoSheet = workbook.addWorksheet('School Info');
    infoSheet.addRow(['ABC School']);
    infoSheet.addRow(['Excellence in Education Since 1990']);
    infoSheet.addRow([]);
    infoSheet.addRow(['Student Report Card']);
    infoSheet.addRow([]);
    infoSheet.addRow(['Student Name:', student.user.name]);
    infoSheet.addRow(['Roll Number:', student.rollNumber]);
    infoSheet.addRow(['Class:', `${student.class}-${student.section}`]);
    infoSheet.addRow(['Academic Year:', student.academicYear || '2024-2025']);
    infoSheet.addRow(['Generated On:', new Date().toLocaleString()]);

    // ✅ Results Sheet
    const resultsSheet = workbook.addWorksheet('Results');

    results.forEach((result, index) => {
      // Add exam header
      resultsSheet.addRow([`${result.examName} - ${new Date(result.examDate).toLocaleDateString()}`]);
      resultsSheet.addRow(['Subject', 'Marks Obtained', 'Total Marks', 'Grade', 'Remarks']);
      
      // Add subjects
      result.subjects.forEach(subject => {
        resultsSheet.addRow([subject.name, subject.marksObtained, subject.totalMarks, subject.grade || 'N/A', subject.remarks || '']);
      });
      
      // Add summary
      resultsSheet.addRow([]);
      resultsSheet.addRow(['Total:', result.totalMarks]);
      resultsSheet.addRow(['Percentage:', `${result.percentage}%`]);
      resultsSheet.addRow(['Grade:', result.grade]);
      resultsSheet.addRow([]);
      resultsSheet.addRow(['-------------------']);
      resultsSheet.addRow([]);
      
      // Add spacing
      for (let i = 0; i < 2; i++) {
        resultsSheet.addRow([]);
      }
    });

    // ✅ Style the workbook
    const headerStyle = {
      font: { bold: true, size: 12 },
      alignment: { horizontal: 'center' }
    };

    resultsSheet.getRow(1).font = { bold: true, size: 14 };
    resultsSheet.getRow(2).font = { bold: true, size: 12 };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report-card-${student.rollNumber}-${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report'
    });
  }
};

// ==================== GENERATE CLASS REPORT ====================

// @desc    Generate Class Report (All Students)
// @route   GET /api/student/class-report/:classId
// @access  Private (Admin only)
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

    // ✅ Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Class Report');

    // Header
    worksheet.addRow(['ABC School']);
    worksheet.addRow([`Class Report - ${classData.className}-${classData.section}`]);
    worksheet.addRow([`Generated On: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    // Table headers
    const headers = ['Roll No', 'Student Name', 'Total Marks', 'Percentage', 'Grade'];
    worksheet.addRow(headers);

    // Get results for each student
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

    // Style
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
    res.status(500).json({
      success: false,
      message: 'Failed to generate class report'
    });
  }
};

// ==================== GENERATE ATTENDANCE REPORT ====================

// @desc    Generate Attendance Report
// @route   GET /api/student/attendance-report/:classId
// @access  Private (Admin/Teacher)
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

    // Check authorization for teacher
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

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Header
    worksheet.addRow(['ABC School']);
    worksheet.addRow([`Attendance Report - ${classData.className}-${classData.section}`]);
    worksheet.addRow([`Month: ${month || 'All'}, Year: ${year || 'All'}`]);
    worksheet.addRow([`Generated On: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    // Table headers
    worksheet.addRow(['Roll No', 'Student Name', 'Present', 'Absent', 'Late', 'Total Days', 'Percentage']);

    // Get attendance for each student
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

    // Style
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
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report'
    });
  }
};

// ==================== GENERATE TEACHER REPORT ====================

// @desc    Generate Teacher Report
// @route   GET /api/student/teacher-report/:teacherId
// @access  Private (Admin only)
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

    // Get teacher's classes
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

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teacher Report');

    // Header
    worksheet.addRow(['ABC School']);
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

    // Style
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
    res.status(500).json({
      success: false,
      message: 'Failed to generate teacher report'
    });
  }
};

// ==================== DOWNLOAD BULK REPORTS ====================

// @desc    Download Bulk Reports (ZIP)
// @route   POST /api/student/bulk-download
// @access  Private (Admin only)
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

    // Create temp directory
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate PDF for each student
    const pdfFiles = [];
    for (let student of students) {
      const pdfPath = path.join(tempDir, `${student.rollNumber}-report-card.pdf`);
      
      // Create PDF for each student
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Simple PDF content
      doc.fontSize(20).text('ABC School', { align: 'center' });
      doc.fontSize(14).text('Report Card', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Student: ${student.user.name}`);
      doc.text(`Roll No: ${student.rollNumber}`);
      doc.text(`Class: ${student.class}-${student.section}`);
      doc.moveDown();

      // Get results
      let query = { student: student._id };
      if (examName) query.examName = examName;
      
      const results = await Result.find(query).sort({ examDate: -1 });
      if (results.length > 0) {
        const result = results[0];
        doc.text(`Exam: ${result.examName}`);
        doc.text(`Total Marks: ${result.totalMarks}`);
        doc.text(`Percentage: ${result.percentage}%`);
        doc.text(`Grade: ${result.grade}`);
      } else {
        doc.text('No results found');
      }

      doc.end();
      pdfFiles.push(pdfPath);
    }

    // Wait for all PDFs to be written
    await Promise.all(pdfFiles.map(file => {
      return new Promise((resolve) => {
        fs.watch(file, { timeout: 5000 }, () => resolve());
        setTimeout(resolve, 5000);
      });
    }));

    // Create ZIP file
    const zipPath = path.join(tempDir, `bulk-reports-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      // Send ZIP file
      res.download(zipPath, `bulk-reports-${classData.className}-${Date.now()}.zip`, (err) => {
        // Cleanup temp files
        pdfFiles.forEach(file => {
          fs.unlink(file, () => {});
        });
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
    res.status(500).json({
      success: false,
      message: 'Failed to generate bulk reports'
    });
  }
};