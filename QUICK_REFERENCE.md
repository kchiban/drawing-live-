# 🚀 Quick Reference Guide

## Command Cheat Sheet

```bash
# Setup
npm install                          # Install dependencies
npm start                           # Run server (production)
npm run dev                         # Run server (development)
npm test                            # Run tests

# Docker
docker build -t drawing-app .       # Build image
docker run -p 3000:3000 drawing-app # Run container
docker-compose up                   # Run with services (Redis)
```

## Environment Variables

```env
PORT=3000
NODE_ENV=development
MAX_HISTORY_SIZE=5000
IP_TRACKING_ENABLED=true
ENABLE_CHAT=true
ENABLE_STATS=true
```

## Socket.io Events (Quick Lookup)

| Event | Direction | Data |
|-------|-----------|------|
| user_join | → Server | `{userName}` |
| draw | → Server | `{fromX, fromY, toX, toY, color, size}` |
| cursor_move | → Server | `{x, y}` |
| clear_canvas | → Server | - |
| send_message | → Server | `{text}` |
| welcome | ← Client | `{socketId, userName, userColor, ...}` |
| user_joined | ← Client | `{userName, onlineCount, ...}` |
| draw | ← Client | Drawing data |
| user_cursor | ← Client | `{socketId, x, y}` |
| receive_message | ← Client | `{userName, text}` |
| user_left | ← Client | `{onlineCount}` |

## API Endpoints (Quick Lookup)

```
GET  /api/stats              # Get all stats
POST /api/ban-ip             # Ban IP: {ip}
POST /api/unban-ip           # Unban IP: {ip}
POST /api/kick-user          # Kick user: {socketId}
GET  /api/health             # Health check
```

## File Locations

| File | Purpose |
|------|---------|
| `server.js` | Main server |
| `public/index.html` | Drawing interface |
| `public/stats.html` | Admin dashboard |
| `.env` | Configuration |
| `Dockerfile` | Container config |

## URLs

```
http://localhost:3000              # Main drawing interface
http://localhost:3000/stats.html   # Admin dashboard
http://localhost:3000/api/stats    # Stats API endpoint
```

## Common Tasks

### Ban a User
1. Go to http://localhost:3000/stats.html
2. Find user's IP in table
3. Click "Ban IP" button

### Clear Drawing History
```javascript
socket.emit('clear_canvas');
```

### Get Online Count
```javascript
const count = document.getElementById('onlineCount').textContent;
```

### Add Custom Color
Edit `server.js` function `generateUserColor()`:
```javascript
const colors = ['#FF6B6B', '#YOUR_COLOR', ...];
```

## Key Files Size Reference

| File | Size | Lines |
|------|------|-------|
| server.js | ~20KB | 500+ |
| public/index.html | ~30KB | 750+ |
| public/stats.html | ~25KB | 600+ |
| IMPLEMENTATION_GUIDE.md | ~100KB | 2000+ |

## Performance Targets

| Metric | Target |
|--------|--------|
| User join latency | <100ms |
| Draw broadcast | <50ms |
| Concurrent users | 100+ |

## Security Checklist (Production)

- [ ] Enable HTTPS/TLS
- [ ] Add authentication
- [ ] Implement rate limiting
- [ ] Use environment secrets
- [ ] Enable database persistence
- [ ] Setup monitoring
- [ ] Regular backups
- [ ] Security audits

## Debugging

### Enable Debug Logging
```javascript
// In server.js
io.engine.on("connection_error", (err) => {
    console.log("Connection Error:", err);
});
```

### Check WebSocket Connection
- Open DevTools (F12)
- Go to Network tab
- Filter by "WS"
- Should see active WebSocket connection

### View Server Logs
```bash
npm start 2>&1 | tee server.log
```

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Canvas not showing | Refresh browser, check console |
| Drawing not syncing | Check WebSocket connection |
| Users not visible | Verify Socket.io loaded |
| Stats page blank | Check /api/stats endpoint |
| IP tracking not working | Check server logs, verify proxy headers |

## Code Snippets

### Get all users
```javascript
const users = Array.from(io.sockets.sockets.keys()).map(id => 
    io.sockets.sockets.get(id)
);
```

### Broadcast to all except sender
```javascript
socket.broadcast.emit('event', data);
```

### Get client IP
```javascript
const ip = socket.handshake.headers['x-forwarded-for'] || 
           socket.handshake.address;
```

### Emit to specific user
```javascript
io.to(socketId).emit('event', data);
```

## Resource Links

- [Socket.io Docs](https://socket.io/docs/)
- [Express Docs](https://expressjs.com/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Node.js Docs](https://nodejs.org/docs/)

## Useful npm Packages

| Package | Use |
|---------|-----|
| nodemon | Auto-restart on changes |
| dotenv | Load env variables |
| cors | CORS middleware |
| helmet | Security headers |
| redis | Redis client |

---

**Last Updated**: January 2024
