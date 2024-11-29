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
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Schema and model
const submissionSchema = new mongoose.Schema({
  submitterName: { type: String, required: true },
  submitterEmail: { type: String, required: true },
  abstractTitle: { type: String, required: true },
  abstractType: { type: String, required: true },
  theme: { type: String, required: true },
  company: { type: String, required: true },
  discipline: { type: String, required: true },
  authorNames: { type: String, required: true },
  authorEmails: { type: String, required: true },
  authorPositions: { type: String, required: true },
  authorContact: { type: String, required: true },
  abstractContent: { type: String, required: true },
  uniqueId: { type: String, required: true, unique: true },
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
  const {
    submitterName,
    submitterEmail,
    abstractTitle,
    abstractType,
    theme,
    company,
    discipline,
    authorNames,
    authorEmails,
    authorPositions,
    authorContact,
    abstractContent,
  } = req.body;

  const uniqueId = Math.random().toString(36).substr(2, 9);

  try {
    // Save submission to the database
    const newSubmission = new Submission({
      submitterName,
      submitterEmail,
      abstractTitle,
      abstractType,
      theme,
      company,
      discipline,
      authorNames,
      authorEmails,
      authorPositions,
      authorContact,
      abstractContent,
      uniqueId,
    });
    await newSubmission.save();

    // Generate the edit link
    const editLink = `${process.env.BASE_URL}/?id=${uniqueId}`;

    // Send email with the edit link
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: submitterEmail,
      subject: 'Edit Your Submission',
      text: `Thank you for your submission! You can edit your submission using the following link: ${editLink}`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ message: 'Error sending email.' });
      }
      res.status(200).json({ message: 'Submission successful! Check your email.' });
    });
  } catch (err) {
    console.error('Error saving submission:', err);
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
    console.error('Error retrieving submission:', err);
    res.status(500).json({ message: 'Error retrieving submission.' });
  }
});

// PUT /update/:id: Update submission data and send updated email link in all cases
app.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const {
    submitterName,
    submitterEmail,
    abstractTitle,
    abstractType,
    theme,
    company,
    discipline,
    authorNames,
    authorEmails,
    authorPositions,
    authorContact,
    abstractContent,
  } = req.body;

  try {
    // Find the existing submission
    const existingSubmission = await Submission.findOne({ uniqueId: id });

    if (!existingSubmission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    // Update the submission with the new data
    const updatedSubmission = await Submission.findOneAndUpdate(
      { uniqueId: id },
      {
        submitterName,
        submitterEmail,
        abstractTitle,
        abstractType,
        theme,
        company,
        discipline,
        authorNames,
        authorEmails,
        authorPositions,
        authorContact,
        abstractContent,
      },
      { new: true }
    );

    // Generate the updated link
    const updatedLink = `${process.env.BASE_URL}/?id=${id}`;

    // Send email to the submitter (new or existing email)
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: submitterEmail,
      subject: 'Updated Submission Link',
      text: `Your submission has been updated! You can edit your updated submission using the following link: ${updatedLink}`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ message: 'Error sending updated email link.' });
      }
    });

    res.status(200).json({ message: 'Submission updated successfully!' });
  } catch (err) {
    console.error('Error updating submission:', err);
    res.status(500).json({ message: 'Error updating submission.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
