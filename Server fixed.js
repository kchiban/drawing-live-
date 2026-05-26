/**
 * Real-time Collaborative Drawing Server
 * FIXED FOR RAILWAY DEPLOYMENT
 * Backend implementation with Socket.io, Express, and IP tracking
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ==================== MIDDLEWARE ====================

app.use(cors());
app.use(express.json());

// Serve static files from public directory with proper path resolution
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Root routes - explicitly serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/stats.html', (req, res) => {
  res.sendFile(path.join(publicPath, 'stats.html'));
});

app.get('/stats', (req, res) => {
  res.sendFile(path.join(publicPath, 'stats.html'));
});

// ==================== DATA STRUCTURES ====================

const users = new Map();
const ipTracker = new Map();
const bannedIps = new Set();
const drawingHistory = [];

// ==================== UTILITY FUNCTIONS ====================

function getClientIp(socket) {
  let ip = socket.handshake.address;
  
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  }
  
  return ip;
}

function generateUserColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
                  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#6C5CE7'];
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

function banIp(ip) {
  bannedIps.add(ip);
  const userToBan = Array.from(users.values()).find(u => u.ip === ip);
  if (userToBan) {
    const socket = io.sockets.sockets.get(userToBan.socketId);
    if (socket) {
      socket.disconnect(true);
    }
  }
  return true;
}

function unbanIp(ip) {
  bannedIps.delete(ip);
  return true;
}

// ==================== SOCKET.IO EVENTS ====================

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  
  console.log(`[${new Date().toISOString()}] New connection from IP: ${clientIp}`);

  if (bannedIps.has(clientIp)) {
    console.log(`[${new Date().toISOString()}] Banned IP attempted connection: ${clientIp}`);
    socket.emit('ip_banned', { message: 'Your IP address has been banned' });
    socket.disconnect(true);
    return;
  }

  // Handle user join
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

    ipTracker.set(clientIp, {
      joinTime: user.joinTime,
      socketId: socket.id,
      userName,
      userColor
    });

    console.log(`[${new Date().toISOString()}] User joined: ${userName} (IP: ${clientIp})`);

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

  // Handle drawing events
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

  // Handle cursor position updates
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

  // Handle clear canvas
  socket.on('clear_canvas', () => {
    const user = users.get(socket.id);
    if (!user) return;

    drawingHistory.length = 0;

    io.emit('canvas_cleared', {
      clearedBy: user.userName,
      socketId: socket.id
    });
  });

  // Handle chat/messages
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

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[${new Date().toISOString()}] User disconnected: ${user.userName} (IP: ${user.ip})`);
      users.delete(socket.id);

      io.emit('user_left', {
        userName: user.userName,
        socketId: socket.id,
        onlineCount: getOnlineCount()
      });
    }
  });
});

// ==================== REST API ENDPOINTS ====================

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
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  
  banIp(ip);
  res.json({ success: true, message: `IP ${ip} banned successfully`, bannedIps: Array.from(bannedIps) });
});

app.post('/api/unban-ip', (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  
  unbanIp(ip);
  res.json({ success: true, message: `IP ${ip} unbanned successfully`, bannedIps: Array.from(bannedIps) });
});

app.post('/api/kick-user', (req, res) => {
  const { socketId } = req.body;
  if (!socketId) {
    return res.status(400).json({ error: 'Socket ID required' });
  }

  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.disconnect(true);
    res.json({ success: true, message: 'User kicked successfully' });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, 'index.html'));
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Real-time Collaborative Drawing Server   ║
║              Server Running On             ║
║              http://localhost:${PORT}              ║
╚════════════════════════════════════════════╝
  `);
});

module.exports = server;
