const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

module.exports = (io) => {
  // GET /api/conversations — List user's conversations
  router.get('/', auth, async (req, res) => {
    try {
      const userId = req.userId;

      const { rows } = await db.query(
        `SELECT
           c.*,
           (
             SELECT json_agg(jsonb_build_object(
               'id', u.id,
               'display_name', u.display_name,
               'avatar_url', u.avatar_url,
               'role', cp2.role
             ))
             FROM users u
             JOIN conversation_participants cp2 ON cp2.user_id = u.id
             WHERE cp2.conversation_id = c.id
           ) AS participants,
           (
             SELECT row_to_json(m.*)
             FROM messages m
             WHERE m.conversation_id = c.id
               AND m.deleted_at IS NULL
             ORDER BY m.created_at DESC
             LIMIT 1
           ) AS last_message,
           (
             SELECT COUNT(*)::int
             FROM messages m
             LEFT JOIN message_status ms ON ms.message_id = m.id AND ms.user_id = $1
             WHERE m.conversation_id = c.id
               AND m.sender_id != $1
               AND (ms.status IS NULL OR ms.status != 'read')
               AND m.deleted_at IS NULL
           ) AS unread_count
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE cp.user_id = $1
         ORDER BY c.updated_at DESC`,
        [userId]
      );

      res.json(rows);
    } catch (err) {
      console.error('Load conversations error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/conversations — Create or return existing direct conversation
  router.post('/', auth, async (req, res) => {
    try {
      const userId = req.userId;
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ error: 'otherUserId is required' });
      }

      // Check if direct conversation already exists between the two users
      const { rows: existing } = await db.query(
        `SELECT c.id
         FROM conversations c
         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
         WHERE c.type = 'direct'
         LIMIT 1`,
        [userId, otherUserId]
      );

      if (existing.length > 0) {
        const { rows } = await db.query(
          'SELECT * FROM conversations WHERE id = $1',
          [existing[0].id]
        );
        return res.json(rows[0]);
      }

      // Create new conversation + participants in a transaction
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: [conversation] } = await client.query(
          `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING *`,
          [userId]
        );

        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id, role)
           VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
          [conversation.id, userId, otherUserId]
        );

        await client.query('COMMIT');
        res.json(conversation);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Create conversation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/conversations/group - Create a group conversation
  router.post('/group', auth, async (req, res) => {
    try {
      const userId = req.userId;
      const { name, participants } = req.body;

      if (!name || !participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ error: 'name and participants array are required' });
      }

      // Ensure creator is in the participants list
      const allParticipants = [...new Set([...participants, userId])];

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: [conversation] } = await client.query(
          `INSERT INTO conversations (type, name, created_by) VALUES ('group', $1, $2) RETURNING *`,
          [name, userId]
        );

        // Add participants: creator is admin, others are members
        for (const pId of allParticipants) {
          const role = pId === userId ? 'admin' : 'member';
          await client.query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ($1, $2, $3)`,
            [conversation.id, pId, role]
          );
        }

        await client.query('COMMIT');
        res.json(conversation);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Create group error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/conversations/:id/participants - Add participants to group
  router.post('/:id/participants', auth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { participants } = req.body;

      // Check if user is admin
      const { rows: participation } = await db.query(
        `SELECT role FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (participation.length === 0 || participation[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can add participants' });
      }

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        
        for (const pId of participants) {
          await client.query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role) 
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [id, pId]
          );
        }

        await client.query('COMMIT');

        // Fetch adder name
        const { rows: adderUsers } = await db.query('SELECT display_name, username FROM users WHERE id = $1', [userId]);
        const adderName = adderUsers[0]?.display_name || adderUsers[0]?.username || 'Admin';

        // Fetch added names
        const { rows: addedUsers } = await db.query('SELECT display_name, username FROM users WHERE id = ANY($1)', [participants]);
        const addedNames = addedUsers.map(u => u.display_name || u.username).join(', ');

        const systemMsgContent = `[SYSTEM] ${adderName} added ${addedNames}.`;

        const { rows: newMsg } = await db.query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type)
           VALUES ($1, $2, $3, 'text') RETURNING *`,
          [id, userId, systemMsgContent]
        );

        const io = req.app.get('io');
        if (io) {
          const fullMessage = {
            ...newMsg[0],
            sender: adderUsers[0]
          };
          io.to(`conversation:${id}`).emit('new_message', fullMessage);
        }

        res.json({ success: true });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Add participants error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/conversations/:id/participants/:targetId/role - Promote/Demote
  router.patch('/:id/participants/:targetId/role', auth, async (req, res) => {
    try {
      const { id, targetId } = req.params;
      const userId = req.userId;
      const { role } = req.body;

      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Check if user is admin
      const { rows: participation } = await db.query(
        `SELECT role FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (participation.length === 0 || participation[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change roles' });
      }

      await db.query(
        `UPDATE conversation_participants SET role = $1 WHERE conversation_id = $2 AND user_id = $3`,
        [role, id, targetId]
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/conversations/:id/participants/:targetId - Remove/Leave group
  router.delete('/:id/participants/:targetId', auth, async (req, res) => {
    try {
      const { id, targetId } = req.params;
      const userId = req.userId;

      if (userId !== targetId) {
        // Checking if remover is admin
        const { rows: participation } = await db.query(
          `SELECT role FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
          [id, userId]
        );

        if (participation.length === 0 || participation[0].role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can remove other participants' });
        }
      }

      // Get user names for the system message
      const { rows: targetUsers } = await db.query('SELECT display_name, username FROM users WHERE id = $1', [targetId]);
      const targetName = targetUsers[0]?.display_name || targetUsers[0]?.username || 'A user';

      await db.query(
        `DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
        [id, targetId]
      );

      let systemMsgContent = `[SYSTEM] ${targetName} left the group.`;
      
      if (userId !== targetId) {
        const { rows: removerUsers } = await db.query('SELECT display_name, username FROM users WHERE id = $1', [userId]);
        const removerName = removerUsers[0]?.display_name || removerUsers[0]?.username || 'Admin';
        systemMsgContent = `[SYSTEM] ${removerName} removed ${targetName}.`;
      }

      // Insert system message
      const { rows: newMsg } = await db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type)
         VALUES ($1, $2, $3, 'text') RETURNING *`,
        [id, userId, systemMsgContent]
      );

      const io = req.app.get('io');
      if (io) {
        const fullMessage = {
          ...newMsg[0],
          sender: targetUsers[0] // or remover's info, doesn't strictly matter for SYSTEM messages
        };
        io.to(`conversation:${id}`).emit('new_message', fullMessage);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/conversations/:id/messages — Get messages in a conversation
  router.get('/:id/messages', auth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Verify user is a participant
      const { rows: participation } = await db.query(
        `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (participation.length === 0) {
        return res.status(403).json({ error: 'Not a participant of this conversation' });
      }

      try {
        await db.query(`ALTER TABLE messages ALTER COLUMN deleted_by TYPE TEXT[] USING deleted_by::text[]`);
      } catch (e) {
        await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}'`);
      }

      console.log(`[FETCH MESSAGES] Called for conv: ${id}, user: ${userId}`);
      const { rows } = await db.query(
        `SELECT
           m.*,
           row_to_json(u.*) AS sender,
           (
             SELECT status FROM message_status ms
             WHERE ms.message_id = m.id AND ms.user_id != m.sender_id
             ORDER BY ms.updated_at DESC
             LIMIT 1
           ) AS status
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
           AND m.deleted_at IS NULL
           AND NOT ($2 = ANY(COALESCE(m.deleted_by, '{}'::text[])))
         ORDER BY m.created_at ASC`,
        [id, userId]
      );
      
      console.log(`[FETCH MESSAGES] Returned ${rows.length} rows for conv: ${id}`);
      res.json(rows);
    } catch (err) {
      console.error('Load messages error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

