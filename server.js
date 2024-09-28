require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');

const app = express();

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure Google Cloud Vision
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Multer configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to backend'
    });
});

// Endpoint to upload media and process with Google Vision
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    // Upload the file to AWS S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${Date.now()}_${file.originalname}`, // Unique key for the file
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const s3Upload = await s3.upload(params).promise();
    const fileUrl = s3Upload.Location;

    // Call Google Vision API for image tagging
    const [result] = await client.labelDetection(file.buffer);
    const labels = result.labelAnnotations.map(label => label.description);

    // Respond with the S3 URL and the tags
    res.json({
      message: 'File uploaded successfully',
      fileUrl,
      tags: labels,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error uploading file or processing image.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
