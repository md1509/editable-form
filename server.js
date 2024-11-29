const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema and model
const submissionSchema = new mongoose.Schema({
  name: String,
  email: String,
  comments: String,
  uniqueId: String,
});

const Submission = mongoose.model('Submission', submissionSchema);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /submit: Handle form submission
app.post('/submit', async (req, res) => {
  const { name, email, comments } = req.body;
  const uniqueId = Math.random().toString(36).substr(2, 9);

  try {
    // Save submission to the database
    const newSubmission = new Submission({ name, email, comments, uniqueId });
    await newSubmission.save();

    // Generate the edit link
    const editLink = `${process.env.BASE_URL}/?id=${uniqueId}`;

    // Send email with the edit link
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Edit Your Submission',
      text: `You can edit your submission using the following link: ${editLink}`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) return res.status(500).json({ message: 'Error sending email' });
      res.status(200).json({ message: 'Submission successful! Check your email.' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Error saving submission.' });
  }
});

// GET /submission/:id: Retrieve submission data for editing
app.get('/submission/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const submission = await Submission.findOne({ uniqueId: id });
    if (submission) {
      res.status(200).json(submission);
    } else {
      res.status(404).json({ message: 'Submission not found.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving submission.' });
  }
});

// PUT /update/:id: Update submission data
app.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, comments } = req.body;

  try {
    const updatedSubmission = await Submission.findOneAndUpdate(
      { uniqueId: id },
      { name, email, comments },
      { new: true }
    );

    if (updatedSubmission) {
      res.status(200).json({ message: 'Submission updated successfully!' });
    } else {
      res.status(404).json({ message: 'Submission not found.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error updating submission.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
