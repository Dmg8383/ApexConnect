const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure calls upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'calls');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}-${Date.now()}.webm`);
  }
});
const upload = multer({ storage });

// GET /api/calls - Fetch call history for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Fetch calls where user is either caller or receiver
    const result = await pool.query(`
      SELECT 
        c.*,
        caller.display_name as caller_name, caller.avatar_url as caller_avatar,
        receiver.display_name as receiver_name, receiver.avatar_url as receiver_avatar
      FROM calls c
      JOIN users caller ON c.caller_id = caller.id
      JOIN users receiver ON c.receiver_id = receiver.id
      WHERE c.caller_id = $1 OR c.receiver_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [userId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// POST /api/calls - Log a new call
router.post('/', async (req, res) => {
  try {
    const { caller_id, receiver_id, type, status, duration } = req.body;

    if (!caller_id || !receiver_id || !type || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO calls (caller_id, receiver_id, type, status, duration)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [caller_id, receiver_id, type, status, duration || 0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error logging call:', error);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// POST /api/calls/:id/recording - Upload call recording
router.post('/:id/recording', upload.single('recording'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No recording file uploaded' });
    }

    const recordingUrl = `/uploads/calls/${req.file.filename}`;

    const result = await pool.query(`
      UPDATE calls
      SET recording_url = $1
      WHERE id = $2
      RETURNING *
    `, [recordingUrl, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading recording:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

module.exports = router;
