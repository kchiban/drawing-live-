const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());

// IMPORTANT: Serve public files BEFORE routes
console.log('__dirname:', __dirname);
console.log('public path:', path.join(__dirname, 'public'));

app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  console.log('GET / - sending index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stats', (req, res) => {
  console.log('GET /stats - sending stats.html');
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.get('/stats.html', (req, res) => {
  console.log('GET /stats.html - sending stats.html');
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.get('/api/health', (req, res) => {
  console.log('GET /api/health');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Data structures
const users = new Map();
const ipTracker = new Map();
const bannedIps = new Set();
const drawingHistory = [];

// Helper functions
function getClientIp(socket) {
  let ip = socket.handshake.address;
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  }
  return ip;
}

function generateUserColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#6C5CE7'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getOnlineCount() {
  return users.size;
}

function getUsersInfo() {
  return Array.from(users.values()).map(user => ({
    socketId: user.socketId,
    userName: user.userName,
    ip: user.ip,
    joinTime: user.joinTime,
    userColor: user.userColor,
    isOnline: true
  }));
}

function getIpTrackingData() {
  return Array.from(ipTracker.entries()).map(([ip, data]) => ({
    ip,
    joinTime: data.joinTime,
    userName: data.userName,
    userColor: data.userColor,
    isBanned: bannedIps.has(ip),
    isOnline: io.sockets.sockets.get(data.socketId) ? true : false
  }));
}

// Socket.io events
io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`[${new Date().toISOString()}] New connection from IP: ${clientIp}`);

  if (bannedIps.has(clientIp)) {
    console.log(`Banned IP attempted: ${clientIp}`);
    socket.emit('ip_banned', { message: 'Your IP has been banned' });
    socket.disconnect(true);
    return;
  }

  // User join
  socket.on('user_join', (data) => {
    const userName = data.userName || `Anonymous #${Math.floor(Math.random() * 10000)}`;
    const userColor = generateUserColor();

    const user = {
      socketId: socket.id,
      userName,
      userColor,
      ip: clientIp,
      joinTime: new Date().toISOString(),
      cursorX: 0,
      cursorY: 0
    };

    users.set(socket.id, user);
    ipTracker.set(clientIp, { joinTime: user.joinTime, socketId: socket.id, userName, userColor });

    console.log(`User joined: ${userName}`);

    socket.emit('welcome', {
      socketId: socket.id,
      userName,
      userColor,
      onlineCount: getOnlineCount(),
      drawingHistory: drawingHistory,
      connectedUsers: getUsersInfo()
    });

    io.emit('user_joined', {
      userName,
      userColor,
      socketId: socket.id,
      onlineCount: getOnlineCount(),
      connectedUsers: getUsersInfo()
    });
  });

  // Drawing
  socket.on('draw', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const drawEvent = {
      from: socket.id,
      userName: user.userName,
      userColor: user.userColor,
      ...data,
      timestamp: Date.now()
    };

    drawingHistory.push(drawEvent);
    if (drawingHistory.length > 5000) {
      drawingHistory.shift();
    }

    socket.broadcast.emit('draw', drawEvent);
  });

  // Cursor
  socket.on('cursor_move', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    user.cursorX = data.x;
    user.cursorY = data.y;

    io.emit('user_cursor', {
      socketId: socket.id,
      userName: user.userName,
      userColor: user.userColor,
      x: data.x,
      y: data.y
    });
  });

  // Clear canvas
  socket.on('clear_canvas', () => {
    const user = users.get(socket.id);
    if (!user) return;

    drawingHistory.length = 0;
    io.emit('canvas_cleared', { clearedBy: user.userName, socketId: socket.id });
  });

  // Messages
  socket.on('send_message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      from: socket.id,
      userName: user.userName,
      userColor: user.userColor,
      text: data.text,
      timestamp: new Date().toISOString()
    };

    io.emit('receive_message', message);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`User disconnected: ${user.userName}`);
      users.delete(socket.id);

      io.emit('user_left', {
        userName: user.userName,
        socketId: socket.id,
        onlineCount: getOnlineCount()
      });
    }
  });
});

// API endpoints
app.get('/api/stats', (req, res) => {
  res.json({
    onlineCount: getOnlineCount(),
    totalIPs: ipTracker.size,
    bannedIPs: Array.from(bannedIps),
    users: getUsersInfo(),
    ipTracking: getIpTrackingData(),
    drawingHistorySize: drawingHistory.length
  });
});

app.post('/api/ban-ip', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  
  bannedIps.add(ip);
  const user = Array.from(users.values()).find(u => u.ip === ip);
  if (user) {
    io.sockets.sockets.get(user.socketId)?.disconnect(true);
  }
  
  res.json({ success: true, bannedIps: Array.from(bannedIps) });
});

app.post('/api/unban-ip', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  
  bannedIps.delete(ip);
  res.json({ success: true, bannedIps: Array.from(bannedIps) });
});

app.post('/api/kick-user', (req, res) => {
  const { socketId } = req.body;
  if (!socketId) return res.status(400).json({ error: 'Socket ID required' });

  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.disconnect(true);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Catch-all - serve index.html for any unknown route (SPA support)
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path} - serving index.html`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║  🎨 Collaborative Drawing Board                  ║
║  ✅ Server Running on Port ${PORT}                    ║
║  📍 http://localhost:${PORT}                        ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = server;
