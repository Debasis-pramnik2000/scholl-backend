const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const processImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);
    
    // Create optimized versions
    const sizes = [
      { width: 150, height: 150, suffix: '-small' },  // Thumbnail
      { width: 300, height: 300, suffix: '-medium' }, // Medium
      { width: 600, height: 600, suffix: '-large' }   // Large
    ];

    for (let size of sizes) {
      const outputPath = path.join(dir, `${basename}${size.suffix}${ext}`);
      await sharp(filePath)
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
    }

    // Store the main image path in req.file
    req.file.processedPath = filePath;
    req.file.url = `/uploads/profiles/${path.basename(filePath)}`;
    
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    // Delete uploaded file if processing fails
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    next(error);
  }
};

module.exports = processImage;