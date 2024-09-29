require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const Media = require('./models/Media');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB', err));

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
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n');
  client = new vision.ImageAnnotatorClient({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey,
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  });
  console.log('Google Cloud Vision client initialized successfully');
  console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
  console.log('Client Email:', process.env.GOOGLE_CLOUD_CLIENT_EMAIL);
  console.log('Private Key length:', privateKey.length);
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

// Updated /upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Upload route hit');
  const file = req.file;

  if (!file) {
    console.log('No file uploaded');
    return res.status(400).send('No file uploaded.');
  }

  try {
    console.log('Attempting to upload to S3');
    // Upload to S3
    const s3Upload = await s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `uploads/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    }).promise();
    console.log('S3 upload successful');

    console.log('Calling Google Vision API');
    // Get tags from Google Vision API
    const [result] = await client.labelDetection(file.buffer);
    const labels = result.labelAnnotations.map(label => label.description);
    console.log('Extracted labels:', labels);

    console.log('Saving data to MongoDB Atlas');
    // Save data to MongoDB Atlas
    const media = new Media({
      userId: req.body.userId || 'defaultUser', // Adjust if needed
      fileUrl: s3Upload.Location,
      tags: labels,
    });
    await media.save();
    console.log('Data saved to MongoDB Atlas');

    // Respond with file URL and tags
    res.json({
      message: 'File uploaded successfully',
      fileUrl: s3Upload.Location,
      tags: labels,
    });
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ 
      error: 'Error processing image',
      details: err.message
    });
  }
});

app.post('/vision', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const [result] = await client.labelDetection(file.buffer);
    const labels = result.labelAnnotations.map(label => label.description);
    console.log('Extracted labels:', labels);
    res.json({ labels });
  } catch (error) {
    console.error('Error calling Google Vision API:', error);
    res.status(500).json({ error: 'Error calling Google Vision API' });
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
