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

// Counter Schema
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    sequenceValue: { type: Number, required: true },
});

const Counter = mongoose.model('Counter', counterSchema);

// Initialize Counter
const initializeCounter = async () => {
    const counter = await Counter.findById('submissionId');
    if (!counter) {
        await Counter.create({ _id: 'submissionId', sequenceValue: 0 });
    }
};

initializeCounter();

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
    uniqueId: { type: Number, required: true, unique: true },
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

    try {
        // Get the next uniqueId from the counter
        const counter = await Counter.findByIdAndUpdate(
            { _id: 'submissionId' },
            { $inc: { sequenceValue: 1 } },
            { new: true, upsert: true }
        );

        const uniqueId = counter.sequenceValue;

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
        const deadline = "01/31/2025, 11:59:59 PM"; // Example deadline

        // Send email with the edit link
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: submitterEmail,
            subject: `[EXTERNAL] 19th QatarEnergy LNG Abstract Submission Confirmation,
            text: `
Dear ${submitterName},

We received your abstract submission to the 19th QatarEnergy LNG Engineering Conference.

Details of your submission:

Submission ID: ${uniqueId}
Submitter Name: ${submitterName}
Submitter Email: ${submitterEmail}
Abstract Title: ${abstractTitle}
Abstract Type: ${abstractType}
Theme: ${theme}
Company: ${company}
Discipline: ${discipline}
Authors Name: ${authorNames}
Abstract: ${abstractContent}

You can modify your submission until the deadline: ${deadline}. 

To Modify your submission click here: ${editLink}

⁠Note: Presentations and Posters guidelines will be provided along with the letter of acceptance.

Best regards,
Abstract Submission Team`,
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

// PUT /update/:id: Update submission data and send an updated email link to the current email address
app.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    const {
        submitterName,
        submitterEmail, // The new email address provided by the submitter
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
                submitterEmail, // Update with the new email address
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
        const deadline = "01/31/2025, 11:59:59 PM"; // Example deadline

        // Send email to the updated submitter email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: submitterEmail, // Always use the updated email
            subject: `[EXTERNAL] Updated: 19th QatarEnergy LNG Abstract Submission Confirmation,
            text: `
Dear ${submitterName},

Your abstract submission to the 19th QatarEnergy LNG Engineering Conference has been successfully updated.

Updated details of your submission:

Submission ID: ${id}
Submitter Name: ${submitterName}
Submitter Email: ${submitterEmail}
Abstract Title: ${abstractTitle}
Abstract Type: ${abstractType}
Theme: ${theme}
Company: ${company}
Discipline: ${discipline}
Authors Names: ${authorNames}
Authors' Emails: ${authorEmails}
Authors' Positions: ${authorPositions}
Authors' Contact Numbers: ${authorContact}
Abstract Content: ${abstractContent}


You can modify your submission until the deadline: ${deadline}. 

To Modify your submission click here: ${updatedLink}

⁠Note: Presentations and Posters guidelines will be provided along with the letter of acceptance.

Best regards,
Abstract Submission Team`,
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error('Error sending email:', err);
                return res.status(500).json({ message: 'Error sending updated email link.' });
            }
        });

        res.status(200).json({ message: 'Submission updated successfully and email sent!' });
    } catch (err) {
        console.error('Error updating submission:', err);
        res.status(500).json({ message: 'Error updating submission.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
