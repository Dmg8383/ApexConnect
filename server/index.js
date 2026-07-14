const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

try {
  fs.copyFileSync(
    path.join(__dirname, '..', 'WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg'),
    path.join(__dirname, '..', 'assets', 'images', 'logo.jpeg')
  );
  console.log('Logo copied successfully to assets/images/logo.jpeg');
} catch (e) {
  // Ignore if it already exists or source missing
}

const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── File Uploads Setup ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically so the frontend can load them via HTTP
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// ── Routes ───────────────────────────────────────────────────────────────────
const usersRouter        = require('./routes/users');
const conversationsRouter = require('./routes/conversations');
const messagesRouter      = require('./routes/messages');
const adminRouter         = require('./routes/admin');
const callsRouter         = require('./routes/calls');

app.use('/api/users',         usersRouter);
app.use('/api/conversations', conversationsRouter(io));
app.use('/api/messages',      messagesRouter(io));
app.use('/api/admin',         adminRouter(io));
app.use('/api/calls',         callsRouter);

// File Upload Endpoint
// Requires the file to be sent in a FormData field named 'file'
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Construct the public URL for the file
  const protocol = req.protocol;
  const host = req.get('host');
  // For local development, construct the full URL to the file
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  
  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
const onlineUsers = new Map(); // userId -> socket.id

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Register user presence
  socket.on('register_user', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user:${userId}`);
    io.emit('user_presence', { userId, status: 'online' });
  });

  // Get initial presence for an array of user IDs
  socket.on('get_presence', (userIds, callback) => {
    const presence = {};
    if (Array.isArray(userIds)) {
      userIds.forEach(id => {
        presence[id] = onlineUsers.has(id) ? 'online' : 'offline';
      });
    }
    if (typeof callback === 'function') callback(presence);
  });

  // Client joins a conversation room to receive messages
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`   ↳ Joined room: conversation:${conversationId}`);
  });

  // Client leaves a conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // Typing indicator — relay to other participants only
  socket.on('typing', ({ conversationId, userId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping,
    });
  });

  // ── WebRTC Calling Signaling ──────────────────────────────────────────────────
  socket.on('call_offer', async (data) => {
    // data: { conversationId, callerId, targetId (string or array), offer, isVideo }
    const targetIds = Array.isArray(data.targetId) ? data.targetId : [data.targetId];
    
    for (const tid of targetIds) {
      if (!tid) continue;
      
      const specificData = { ...data, targetId: tid };
      socket.to(`user:${tid}`).emit('call_offer', specificData);
      
      // Send push notification for incoming call
      try {
        const db = require('./db');
        const [callerRes, targetRes] = await Promise.all([
          db.query('SELECT display_name, username FROM users WHERE id = $1', [data.callerId]),
          db.query('SELECT push_token FROM users WHERE id = $1', [tid])
        ]);
        
        const caller = callerRes.rows[0];
        const target = targetRes.rows[0];
        
        if (caller && target && target.push_token) {
          const callType = data.isVideo ? 'Video' : 'Voice';
          const callerName = caller.display_name || caller.username;
          
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: target.push_token,
              title: `Incoming ${callType} Call`,
              body: `${callerName} is calling you...`,
              data: { type: 'call_offer', ...specificData },
              sound: 'default',
              priority: 'high'
            }),
          }).catch(err => console.error('Push notification network error:', err));
        }
      } catch (err) {
        console.error('Failed to send call push notification:', err);
      }
    }
  });

  socket.on('call_answer', (data) => {
    // data: { conversationId, fromId, targetId, answer }
    if (data.targetId) socket.to(`user:${data.targetId}`).emit('call_answer', data);
  });

  socket.on('ice_candidate', (data) => {
    // data: { conversationId, fromId, targetId, candidate }
    const targetIds = Array.isArray(data.targetId) ? data.targetId : [data.targetId];
    for (const tid of targetIds) {
      if (tid) socket.to(`user:${tid}`).emit('ice_candidate', { ...data, targetId: tid });
    }
  });

  socket.on('call_end', (data) => {
    // data: { conversationId, fromId, targetId }
    const targetIds = Array.isArray(data.targetId) ? data.targetId : [data.targetId];
    for (const tid of targetIds) {
      if (tid) socket.to(`user:${tid}`).emit('call_end', { ...data, targetId: tid });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user_presence', { userId: socket.userId, status: 'offline' });
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket ready on ws://localhost:${PORT}`);
});
