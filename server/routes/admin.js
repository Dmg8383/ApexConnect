const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
module.exports = (io) => {
const adminAuth = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error validating admin' });
  }
};

// Apply auth and adminAuth to all routes in this file
router.use(auth);
router.use(adminAuth);

// GET /api/admin/users
// Get all users with their contact counts
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.display_name, 
        u.created_at, 
        u.last_seen_at,
        u.is_admin,
        u.is_active,
        COUNT(DISTINCT cp.conversation_id) as conversation_count
      FROM users u
      LEFT JOIN conversation_participants cp ON u.id = cp.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    // Parse the bigints from COUNT
    const formattedRows = rows.map(row => ({
      ...row,
      conversation_count: parseInt(row.conversation_count, 10)
    }));

    res.json(formattedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id
// Update a user's details
router.patch('/users/:id', async (req, res) => {
  try {
    const { username, display_name, is_admin, is_active } = req.body;
    const { rows } = await db.query(`
      UPDATE users 
      SET 
        username = COALESCE($1, username),
        display_name = COALESCE($2, display_name),
        is_admin = COALESCE($3, is_admin),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, username, display_name, is_admin, is_active, created_at, last_seen_at
    `, [username, display_name, is_admin, is_active, req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1 (Localhost)';
    
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
      [req.userId, 'update_user', ip, JSON.stringify({ target_user: req.params.id })]
    );

    // If the user was just deactivated, emit an event so their client logs them out
    if (is_active === false) {
      io.emit('account_deactivated', { userId: req.params.id });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
// Delete a user entirely
router.delete('/users/:id', async (req, res) => {
  try {
    // Delete from users (cascade should handle the rest if FKs are set up, but let's be safe)
    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1') ip = '127.0.0.1 (Localhost)';
    
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
      [req.userId, 'delete_user', ip, JSON.stringify({ target_user: req.params.id })]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit_logs
router.get('/audit_logs', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, u.username 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/conversations
router.get('/conversations', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        c.id, c.type, c.created_at,
        COUNT(cp.user_id) as participant_count
      FROM conversations c
      LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    const formattedRows = rows.map(row => ({
      ...row,
      participant_count: parseInt(row.participant_count, 10)
    }));
    res.json(formattedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/support
router.get('/support', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, u.username, u.display_name 
      FROM support_messages s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/support/:id
router.patch('/support/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { rows } = await db.query(
      'UPDATE support_messages SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
};
