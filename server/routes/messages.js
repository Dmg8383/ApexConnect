const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

module.exports = (io) => {
  // POST /api/messages — Send a message
  router.post('/', auth, async (req, res) => {
    try {
      const { conversation_id, content, message_type = 'text', reply_to, media_url } = req.body;
      const userId = req.userId;

      if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
      }

      // Verify user is a participant
      const { rows: participation } = await db.query(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversation_id, userId]
      );

      if (participation.length === 0) {
        return res.status(403).json({ error: 'Not a participant of this conversation' });
      }

      // Insert message
      const { rows: [message] } = await db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, reply_to, media_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [conversation_id, userId, content || null, message_type, reply_to || null, media_url || null]
      );

      // Fetch sender info
      const { rows: [sender] } = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      // Touch conversation updated_at
      await db.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversation_id]
      );

      const fullMessage = { ...message, sender, status: 'sent' };

      // Broadcast to all Socket.io clients in this conversation room
      io.to(`conversation:${conversation_id}`).emit('new_message', fullMessage);

      res.json(fullMessage);
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/messages/status — Bulk update read receipts
  router.post('/status', auth, async (req, res) => {
    try {
      const { message_ids, status } = req.body;
      const userId = req.userId;

      if (!message_ids?.length) {
        return res.status(400).json({ error: 'message_ids array is required' });
      }

      for (const messageId of message_ids) {
        await db.query(
          `INSERT INTO message_status (message_id, user_id, status)
           VALUES ($1, $2, $3)
           ON CONFLICT (message_id, user_id)
           DO UPDATE SET status = $3, updated_at = NOW()`,
          [messageId, userId, status || 'read']
        );
        
        // Broadcast the status update to the conversation room
        const { rows: [msg] } = await db.query('SELECT conversation_id FROM messages WHERE id = $1', [messageId]);
        if (msg) {
          io.to(`conversation:${msg.conversation_id}`).emit('message_status_updated', {
            message_id: messageId,
            conversation_id: msg.conversation_id,
            status: status || 'read'
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/messages/:id — Edit a message
  router.patch('/:id', auth, async (req, res) => {
    try {
      const { content } = req.body;

      const { rows } = await db.query(
        `UPDATE messages
         SET content = $1, is_edited = TRUE, updated_at = NOW()
         WHERE id = $2 AND sender_id = $3
         RETURNING *`,
        [content, req.params.id, req.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Message not found or not your message' });
      }

      io.to(`conversation:${rows[0].conversation_id}`).emit('message_updated', rows[0]);
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



  // DELETE /api/messages/clear-all — Clear all chats for the current user
  router.delete('/clear-all', auth, async (req, res) => {
    try {
      const userId = req.userId;

      try {
        await db.query(`ALTER TABLE messages ALTER COLUMN deleted_by TYPE TEXT[] USING deleted_by::text[]`);
      } catch (e) {
        await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}'`);
      }

      await db.query(`
        UPDATE messages
        SET deleted_by = array_append(COALESCE(deleted_by, '{}'::text[]), $1)
        WHERE conversation_id IN (
          SELECT conversation_id FROM conversation_participants WHERE user_id = $1
        )
        AND NOT ($1 = ANY(COALESCE(deleted_by, '{}'::text[])))
      `, [userId]);

      res.json({ success: true, message: 'All chats cleared' });
    } catch (err) {
      console.error('Clear chats error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/messages/clear/:conversationId — Clear messages for one conversation
  router.delete('/clear/:conversationId', auth, async (req, res) => {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;

      // Verify user is a participant in this conversation
      const memberCheck = await db.query(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized for this conversation' });
      }

      try {
        await db.query(`ALTER TABLE messages ALTER COLUMN deleted_by TYPE TEXT[] USING deleted_by::text[]`);
      } catch (e) {
        await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}'`);
      }

      console.log(`[CLEAR CHAT] Called for conv: ${conversationId}, user: ${userId}`);
      // Update messages to append userId to deleted_by array
      const updateRes = await db.query(`
        UPDATE messages 
        SET deleted_by = array_append(COALESCE(deleted_by, '{}'::text[]), $2)
        WHERE conversation_id = $1
        AND NOT ($2 = ANY(COALESCE(deleted_by, '{}'::text[])))
        RETURNING id, deleted_by
      `, [conversationId, userId]);
      
      console.log(`[CLEAR CHAT] Updated ${updateRes.rowCount} rows.`);

      res.json({ success: true, message: 'Chat cleared for user' });
    } catch (err) {
      console.error('Clear conversation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/messages/:id — Soft delete a message
  router.delete('/:id', auth, async (req, res) => {
    try {
      const { rows } = await db.query(
        `UPDATE messages
         SET deleted_at = NOW()
         WHERE id = $1 AND sender_id = $2
         RETURNING *`,
        [req.params.id, req.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Message not found or not your message' });
      }

      io.to(`conversation:${rows[0].conversation_id}`).emit('message_deleted', {
        id: req.params.id,
        conversation_id: rows[0].conversation_id,
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
