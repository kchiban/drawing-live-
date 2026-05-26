const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data
const users = new Map();
const bannedIps = new Set();
const drawingHistory = [];

function getClientIp(socket) {
  let ip = socket.handshake.address;
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) ip = forwarded.split(',')[0].trim();
  return ip;
}

// Socket events
io.on('connection', (socket) => {
  const ip = getClientIp(socket);
  console.log(`Connected: ${ip}`);

  if (bannedIps.has(ip)) {
    socket.disconnect(true);
    return;
  }

  socket.on('user_join', (data) => {
    const user = {
      socketId: socket.id,
      userName: data.userName || 'Anonymous',
      userColor: '#' + Math.floor(Math.random()*16777215).toString(16),
      ip,
      joinTime: new Date().toISOString()
    };
    
    users.set(socket.id, user);
    
    socket.emit('welcome', {
      socketId: socket.id,
      userName: user.userName,
      userColor: user.userColor,
      onlineCount: users.size,
      drawingHistory,
      connectedUsers: Array.from(users.values())
    });

    io.emit('user_joined', {
      userName: user.userName,
      onlineCount: users.size
    });
  });

  socket.on('draw', (data) => {
    const user = users.get(socket.id);
    if (user) {
      const event = { ...data, userName: user.userName, userColor: user.userColor };
      drawingHistory.push(event);
      if (drawingHistory.length > 5000) drawingHistory.shift();
      socket.broadcast.emit('draw', event);
    }
  });

  socket.on('cursor_move', (data) => {
    socket.broadcast.emit('user_cursor', { socketId: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('user_left', { onlineCount: users.size });
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    onlineCount: users.size,
    users: Array.from(users.values()),
    drawingHistorySize: drawingHistory.length
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;
