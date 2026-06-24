const express = require('express');
const router = express.Router();
const http = require('http');
const db = require('../db');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateUserId() {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '365d' });
}

// Helper to send SMS using the specified API
function sendSMS(mobile, message) {
  return new Promise((resolve, reject) => {
    const authkey = '353874616e6f7737343546';
    const sender = 'AUTHET';
    const route = '2';
    const country = '91';
    const dlt_te_id = '1707176519519241645';

    const path = `/api/sendhttp.php?authkey=${authkey}&mobiles=91${mobile}&message=${encodeURIComponent(message)}&sender=${sender}&route=${route}&country=${country}&DLT_TE_ID=${dlt_te_id}`;

    const options = {
      hostname: '136.243.171.112',
      port: 80,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log("SMS SENT RESPONSE:", data);
        resolve(data);
      });
    });

    req.on('error', error => {
      console.error("SMS ERROR:", error);
      reject(error);
    });

    req.end();
  });
}

// POST /api/users — Create a new user account
router.post('/', async (req, res) => {
  try {
    const { display_name, username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if username exists
    const existing = await db.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const userId = generateUserId();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { rows } = await db.query(
      `INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, username, passwordHash, display_name || username]
    );

    const userToReturn = { ...rows[0] };
    delete userToReturn.password_hash; // Don't send hash back

    const token = generateToken(userId);
    res.json({ user: userToReturn, token });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/signin — Sign in with existing username and password
router.post('/signin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    } catch (e) {
      // Ignore if it already exists or if there's a race condition
    }

    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.is_active === false) {
      return res.status(401).json({ error: 'No user found' });
    }

    const userToReturn = { ...user };
    delete userToReturn.password_hash;

    const token = generateToken(user.id);

    // Audit Log
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1 (Localhost)';
    
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
        [user.id, 'login', ip, JSON.stringify({ username: user.username })]
      );
    } catch (e) { console.error('Failed to write audit log', e); }

    res.json({ user: userToReturn, token });
  } catch (err) {
    console.error('Sign in error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/request-otp — Send an OTP to a mobile number
router.post('/request-otp', async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate a 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save to otps table
    await db.query(
      'INSERT INTO otps (phone_number, code, expires_at) VALUES ($1, $2, $3)',
      [phone_number, generatedOtp, expiresAt]
    );

    // Send SMS
    const message = `Dear user , Your OTP is ${generatedOtp}. Use this to verify your authetik account within 10 minutes. For your security, do not share this code with anyone.`;
    const apiResponse = await sendSMS(phone_number, message);

    res.json({ success: true, message: 'OTP Sent Successfully', apiResponse });
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/users/verify-otp — Verify OTP and sign in or register
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone_number, code } = req.body;
    if (!phone_number || !code) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    // Check if OTP is valid and not expired
    const otpCheck = await db.query(
      'SELECT id FROM otps WHERE phone_number = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [phone_number, code]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Delete used OTP
    await db.query('DELETE FROM otps WHERE id = $1', [otpCheck.rows[0].id]);

    // Check if user exists
    let { rows } = await db.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    let user;
    let userId;

    if (rows.length === 0) {
      // Create new user
      userId = generateUserId();
      // Generate a unique fallback username based on phone
      const username = `user_${phone_number}`;
      
      const insertRes = await db.query(
        `INSERT INTO users (id, username, display_name, phone_number) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, username, phone_number, phone_number]
      );
      user = insertRes.rows[0];
    } else {
      user = rows[0];
      userId = user.id;
    }

    const userToReturn = { ...user };
    delete userToReturn.password_hash;

    const token = generateToken(userId);

    // Audit Log
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1 (Localhost)';
    
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
        [userId, 'login_otp', ip, JSON.stringify({ phone_number })]
      );
    } catch (e) { console.error('Failed to write audit log', e); }

    res.json({ user: userToReturn, token });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// POST /api/users/logout — Log out user
router.post('/logout', auth, async (req, res) => {
  try {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1 (Localhost)';
    
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [req.userId, 'logout', ip]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me — Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me — Update profile
router.patch('/me', auth, async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    const { rows } = await db.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           avatar_url   = COALESCE($2, avatar_url),
           updated_at   = NOW()
       WHERE id = $3
       RETURNING *`,
      [display_name, avatar_url, req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/search/:query — Search users by ID or name
router.get('/search/:query', auth, async (req, res) => {
  try {
    const q = `%${req.params.query.toUpperCase()}%`;
    const { rows } = await db.query(
      `SELECT * FROM users
       WHERE (id LIKE $1 OR UPPER(display_name) LIKE $1)
         AND id != $2
       LIMIT 20`,
      [q, req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id — Get a specific user by ID or username
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1 OR username = $2', [req.params.id, req.params.id.toLowerCase()]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/support — Submit a help center ticket
router.post('/support', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    
    await db.query(
      'INSERT INTO support_messages (user_id, message) VALUES ($1, $2)',
      [req.userId, message]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
