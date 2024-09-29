require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());
// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure Google Cloud Vision
let client;
try {
  client = new vision.ImageAnnotatorClient({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  });
  console.log('Google Cloud Vision client initialized successfully');
} catch (error) {
  console.error('Error initializing Google Cloud Vision client:', error);
}

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
  console.log('Upload route hit');
  const file = req.file;

  if (!file) {
    console.log('No file uploaded');
    return res.status(400).send('No file uploaded.');
  }

  try {
    console.log('Attempting to upload to S3');
    // Upload the file to AWS S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${Date.now()}_${file.originalname}`, // Unique key for the file
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const s3Upload = await s3.upload(params).promise();
    const fileUrl = s3Upload.Location;

    console.log('S3 upload successful');

    console.log('Calling Google Vision API');
    // Call Google Vision API for image tagging
    const [result] = await client.labelDetection(file.buffer);
    const labels = result.labelAnnotations.map(label => label.description);

    console.log('Google Vision API call successful');

    // Respond with the S3 URL and the tags
    res.json({
      message: 'File uploaded successfully',
      fileUrl,
      tags: labels,
    });
  } catch (err) {
    console.error('Detailed error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      error: 'Error uploading file or processing image',
      details: err.message,
      stack: err.stack,
      googleCredentials: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'Set' : 'Not set',
        clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL ? 'Set' : 'Not set',
        privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? 'Set (length: ' + process.env.GOOGLE_CLOUD_PRIVATE_KEY.length + ')' : 'Not set'
      }
    });
  }
});

// Test environment variables route
app.get('/test-env', (req, res) => {
  res.json({
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set',
    AWS_REGION: process.env.AWS_REGION,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'Set' : 'Not set',
    GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? 'Set' : 'Not set',
    GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL ? 'Set' : 'Not set',
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
