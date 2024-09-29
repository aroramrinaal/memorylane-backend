const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    fileUrl: String, // The AWS S3 URL
    tags: [String], // Array of tags from Google Vision
    uploadDate: { type: Date, default: Date.now } // When the file was uploaded
  });
  
  const Media = mongoose.model('Media', mediaSchema);
  
  module.exports = Media;