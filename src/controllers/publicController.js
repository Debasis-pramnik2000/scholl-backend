const Notice = require('../models/Notice');
const PDFDocument = require('pdfkit');

// @desc    Get public notices for home page
// @route   GET /api/public/notices
// @access  Public
exports.getPublicNotices = async (req, res) => {
  try {
    const notices = await Notice.find({
      isPublic: true,
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    })
    .populate('author', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('title content priority createdAt views attachments author');

    res.status(200).json({
      success: true,
      data: notices
    });
  } catch (error) {
    console.error('Get public notices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single public notice
// @route   GET /api/public/notices/:id
// @access  Public
exports.getPublicNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id)
      .populate('author', 'name');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // Increment views
    notice.views = (notice.views || 0) + 1;
    await notice.save();

    res.status(200).json({
      success: true,
      data: notice
    });
  } catch (error) {
    console.error('Get public notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Download notice as PDF
// @route   GET /api/public/notices/:id/pdf
// @access  Public
exports.downloadNoticePDF = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id)
      .populate('author', 'name');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // ✅ Create PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=notice-${notice._id}.pdf`);

    doc.pipe(res);

    // ✅ School Header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#1a1a2e')
       .text('ABC School', { align: 'center' });

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text('Excellence in Education Since 1990', { align: 'center' });

    doc.moveDown();
    doc.lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .strokeColor('#3498db')
       .stroke();
    doc.moveDown();

    // ✅ Notice Title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text(notice.title, { align: 'center' });
    
    doc.moveDown();

    // ✅ Priority Badge
    const priorityColors = {
      'Low': '#95a5a6',
      'Medium': '#3498db',
      'High': '#f39c12',
      'Urgent': '#e74c3c'
    };
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor(priorityColors[notice.priority] || '#3498db')
       .text(`Priority: ${notice.priority}`, { align: 'center' });
    
    doc.moveDown();

    // ✅ Date
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Date: ${new Date(notice.createdAt).toLocaleDateString('en-IN', {
         day: '2-digit',
         month: 'long',
         year: 'numeric'
       })}`, { align: 'center' });
    
    doc.moveDown(2);

    // ✅ Content
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#2c3e50')
       .text(notice.content, {
         align: 'justify',
         lineGap: 5
       });

    doc.moveDown(2);

    // ✅ Attachments (Fixed: attachments are strings, not objects)
    if (notice.attachments && notice.attachments.length > 0) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text('Attachments:');
      
      doc.moveDown(0.5);
      
      notice.attachments.forEach((att, index) => {
        // ✅ Fixed: att is a string, so use it directly
        const fileName = typeof att === 'string' 
          ? att.split('/').pop() 
          : (att.fileName || 'Attachment');
        const fileUrl = typeof att === 'string' 
          ? att 
          : (att.fileUrl || '#');
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#3498db')
           .text(`${index + 1}. ${fileName}`, { link: fileUrl });
      });
      
      doc.moveDown(2);
    }

    // ✅ Footer
    const footerY = doc.page.height - 80;
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#95a5a6')
       .text('This is a system generated notice.', 50, footerY, { align: 'center' })
       .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, footerY + 15, { align: 'center' })
       .text(`Posted by: ${notice.author?.name || 'Admin'}`, 50, footerY + 30, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Download notice PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF'
    });
  }
};