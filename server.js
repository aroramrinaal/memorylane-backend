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
    const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHaaRnotbV4bbX
nuNcvJ7iM+7O/ZtP8acwoHXoDEUQTg1y2BgL6FEKGY132+JPHMJbIWf5Aq336Msb
RQgsBu8YwZqn/qQfLLw5EpYSMWYFiMiba3sjXrN/xB0N4W2jqmYpx0lNKiSRnxVo
oDM+aShN0+cWsGaWVQOvtJAygDodV9fMFVz9iyc6jP/V90zxFHP3Q10D3PX6Jmsj
h2QmXDQzvJGL3m6gumfzDD6RKBQ1r4v1ITaOK+glBK52oilSPOC/jRBqyjy4MV69
ReCjIBOmNo44WR1R3w9ElLtnOOruhLZWAK0yr2GYsXQb2SrTmX0u1fXVosLQyDu/
QMsh0LuVAgMBAAECggEAEaiZvfGuG5+SzPJNiPtNCJP3vE258LDiEMzM1CEuBn0a
9MYNDxTiBEZyACCxIDdYQLCrH+JsXG05ey84Q4nTp3oRg3npt7cC7fzm3DKSqb/M
n/K7I00yEQjhV8bUKi+fP2jd5V7rgRe40hyJnSe7wXSX3Kr/UqWxn2AaetZfDxT9
lmoVqLYrajrVSqUFkL2luitbSE5XwdHlBpKeTpJ14XyYUAnoaGdKgGqn89hiUk43
s5hGbTpsqNRi4wIEc1//QG9icG3Kn+JvKtyRBNYGytep5wG/M5OgQPJakqSOOjHC
NhGSRQ2cFfAP0yKU92UO6eucOhUNbPza3+1QW11aEQKBgQD6IhtDwBUoHWsU76Gj
vPtazyTtOPyVWW0lDtLtd0Myq5R25IqsUV8FfbEsh6/LVKXbLCXsWMV1eR/Y0ADq
EEeaWzERizpkJFVRAKUAmWld+h+XzFF1YfXiKIBCEFaSSEjqkjHzAfbVakHPcEnQ
fKByc60iveZ7gom44UtaloQrzQKBgQDMFv2O3zPeO7Z2I1lKdn+MVuUurVD9qCv9
9de8ZLx8Dakd0uCb2m5g8xDnLsuU393/fOmk96xH9eN6yUiVzwzpvTzWJQyRgak8
Me6gaWOezmkFWJ1FuylMqwo9QosORENSM6Oo5Kf/7WjWqWFttKRg8pWTFCZum2eQ
FoXvjgZW6QKBgQCTwTvrzHZy6NXNWzRXXZX48W31t3j03AtuHZCZd565OsOLa7tC
yRphSvsyu8ArUwhaLH0GXPXfS7p1P4Gawh0Z4A5fN6g5aYEARWoyrWyhd9PbvnTL
6x7tBlGlNLN+27Y+4jchPiLJtGfFmqXvwv6gPRaj9BtHEDg8ftEdZNYUbQKBgC2f
+iFFfrfwy3KPpneCFDOQfX2420FJpkQJAKiqMITfHO6A5RuScliUHjRAftySS3PB
Pg5WHBqeOrOJagOrnOxoFMCe2bdxsB633uvXg6DN7iZ2z/n1xF7SYeCeDq4qzo4C
41RvgasyLNzIUvKOjqzprkyKFalmbnmEv351Vq95AoGAIcefxOOhdMNGjU+z6AOT
geob4/B8bcxnGtfCdpG2YA67bxTJoVWDLCLRBAodrGb/O8x97BWOPZFIqUgK88XQ
pHG+RpG6FQKpbq+rALSf414l6YfOmwO9Q7KGjUTc5xRJfIIxorVfUjGusuv6Vct/
5wiFr3nvDpTQKTgukdVm2PU=
-----END PRIVATE KEY-----`;

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
    // S3 upload code
    const s3Upload = await s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `uploads/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    }).promise();
    console.log('S3 upload successful');

    console.log('Calling Google Vision API');
    console.log('File buffer length:', file.buffer.length);
    console.log('File mimetype:', file.mimetype);
    
    // Call Google Vision API for image tagging
    const [result] = await client.labelDetection(file.buffer);
    console.log('Google Vision API response:', JSON.stringify(result, null, 2));
    
    const labels = result.labelAnnotations.map(label => label.description);
    console.log('Extracted labels:', labels);

    // Respond with the S3 URL and the tags
    res.json({
      message: 'File uploaded successfully',
      fileUrl: s3Upload.Location,
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
        privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? `Set (length: ${process.env.GOOGLE_CLOUD_PRIVATE_KEY.length})` : 'Not set'
      },
      fileInfo: file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      } : 'No file info available'
    });
  }
});

app.post('/test-vision', upload.single('file'), async (req, res) => {
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
