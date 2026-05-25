# 🚀 Deploying to Vercel - Complete Guide

## Overview

Vercel is perfect for deploying Node.js applications. This guide walks you through deploying your collaborative drawing board to Vercel.

---

## ⚠️ Important Note About Vercel

**Vercel has limitations for this project:**

1. **Serverless Functions** - Vercel runs serverless, which means:
   - WebSocket connections (Socket.io) need special handling
   - In-memory data is not persistent (resets on new deployment)
   - Real-time drawing history will be lost
   
2. **Better Alternatives for This Project:**
   - ✅ **Railway** - Better WebSocket support
   - ✅ **Render** - Full Node.js server support
   - ✅ **Fly.io** - Optimized for real-time apps
   - ✅ **DigitalOcean** - VPS with full control

**If you still want to use Vercel**, follow this guide with the understanding that real-time features may have limitations.

---

## 📋 Prerequisites

1. **Vercel Account** - Sign up at https://vercel.com
2. **GitHub Account** - Required for deploying from Git
3. **Node.js 14+** - Installed locally
4. **Git** - For version control

---

## 🔧 Step 1: Prepare Your Project

### 1.1 Create `vercel.json` Configuration

Create a `vercel.json` file in your project root:

```json
{
  "buildCommand": "npm install",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nodejs",
  "nodeVersion": "18.x",
  "env": {
    "PORT": "3000",
    "NODE_ENV": "production"
  },
  "functions": {
    "server.js": {
      "memory": 3008,
      "maxDuration": 300
    }
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

### 1.2 Update `package.json`

Make sure your `package.json` has a start script:

```json
{
  "name": "collaborative-drawing-board",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5"
  }
}
```

### 1.3 Create `.env.production` File

```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

---

## 📤 Step 2: Push to GitHub

### 2.1 Initialize Git Repository

```bash
cd collaborative-drawing-board
git init
git add .
git commit -m "Initial commit: Collaborative Drawing Board"
```

### 2.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `collaborative-drawing`)
3. Don't initialize with README, .gitignore, or license

### 2.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/collaborative-drawing.git
git branch -M main
git push -u origin main
```

---

## 🚀 Step 3: Deploy to Vercel

### 3.1 Connect to Vercel

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to GitHub account? Yes
# - Create GitHub project? Yes
# - Clone existing project? No
# - Project name: collaborative-drawing
# - Framework: Other
# - Production branch: main
```

**Option B: Using Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Select "Import Git Repository"
4. Connect your GitHub account
5. Select your `collaborative-drawing` repository
6. Click "Import"
7. Configuration should auto-detect from `vercel.json`
8. Click "Deploy"

### 3.2 Configure Environment Variables

In Vercel Dashboard:

1. Go to your project → Settings → Environment Variables
2. Add variables:
   ```
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://your-app-name.vercel.app
   ```
3. Save and redeploy

---

## 🔧 Step 4: Fix Socket.io for Vercel (Important)

### 4.1 Update `server.js` for Vercel

Socket.io needs special handling on Vercel. Update your server.js:

```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// IMPORTANT: Configure Socket.io for Vercel
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Vercel-specific configuration
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
  serveClient: false
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ... rest of your code ...

// Export for Vercel
module.exports = app;
```

### 4.2 Create `api/socket.js` for Vercel WebSocket

Create a new file `api/socket.js`:

```javascript
import { Server } from 'socket.io';
import { createServer } from 'http';

// This helps Vercel handle WebSocket connections
export default function handler(req, res) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      // Your Socket.io logic here
      socket.on('user_join', (data) => {
        io.emit('user_joined', data);
      });
    });

    res.socket.server.io = io;
  }

  res.status(200).json({ ok: true });
}
```

---

## 📝 Step 5: Configuration Files for Vercel

### 5.1 Update `vercel.json` (Complete)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": "public/**",
        "memory": 3008,
        "maxDuration": 300
      }
    }
  ],
  "routes": [
    {
      "src": "/socket.io",
      "dest": "server.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "api/$1.js"
    },
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "PORT": "3000"
  }
}
```

### 5.2 Create `package.json` Updates

```json
{
  "name": "collaborative-drawing-board",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "echo 'Build step for Vercel'",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 🚀 Step 6: Deploy

### 6.1 Using Git Push

```bash
# Make changes locally
git add .
git commit -m "Configure for Vercel deployment"
git push origin main

# Vercel will auto-deploy on push
```

### 6.2 Using Vercel CLI

```bash
vercel --prod
```

---

## ✅ Step 7: Verify Deployment

After deployment, verify everything works:

```bash
# Check your deployment URL (displayed after deploy)
https://your-app-name.vercel.app

# Test the drawing interface
# http://your-app-name.vercel.app

# Test the stats page
# http://your-app-name.vercel.app/stats.html

# Check API health
# http://your-app-name.vercel.app/api/health
```

---

## ⚙️ Troubleshooting

### Issue: WebSocket Connection Fails

**Solution 1:** Enable WebSocket polling fallback in client

In `public/index.html`, update Socket.io initialization:

```javascript
const socket = io(undefined, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

**Solution 2:** Check Vercel logs

```bash
vercel logs your-app-name
```

### Issue: Drawing History Lost on Reload

**Why:** Vercel is serverless, in-memory data resets

**Solution:** Add database persistence

```bash
# Use MongoDB Atlas (free tier available)
# Or PostgreSQL with PgBouncer
```

### Issue: CORS Errors

**Solution:** Update `vercel.json` environment variable:

```json
{
  "env": {
    "CORS_ORIGIN": "https://your-app-name.vercel.app"
  }
}
```

### Issue: Functions Timeout

**Solution:** Increase timeout in `vercel.json`:

```json
{
  "functions": {
    "server.js": {
      "maxDuration": 300
    }
  }
}
```

---

## 🔄 Continuous Deployment

Vercel automatically deploys on push to main branch.

### Deploy Workflow

```
1. Make changes locally
2. Test with: npm run dev
3. Commit: git commit -m "description"
4. Push: git push origin main
5. Vercel auto-deploys
6. View deployment: https://your-app-name.vercel.app
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Using Vercel CLI
vercel logs your-app-name --follow

# Or in Vercel Dashboard:
# Project → Deployments → Click deployment → Logs
```

### Check Deployment Status

```bash
vercel status
```

### Roll Back Deployment

```bash
vercel rollback
```

---

## 🔒 Environment Variables in Vercel

### Set Production Variables

```bash
vercel env add PORT 3000
vercel env add NODE_ENV production
vercel env add CORS_ORIGIN https://your-app-name.vercel.app
```

### View Variables

```bash
vercel env list
```

### Redeploy with New Variables

```bash
vercel --prod
```

---

## 💰 Vercel Pricing & Limits

### Free Tier
- ✅ 100 Serverless Function invocations
- ✅ 3 Concurrent Serverless Functions
- ⚠️ May have WebSocket limitations
- ⚠️ Data resets on deployment

### Pro Tier ($20/month)
- ✅ Better performance
- ✅ More function invocations
- ✅ Priority support

**For this project**, consider **Railway** or **Render** for better real-time support.

---

## 🎯 Recommended: Use Railway Instead

If you want better real-time support, use Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up

# View logs
railway logs
```

Railway is better for this project because:
- ✅ Better WebSocket support
- ✅ Persistent memory between requests
- ✅ No serverless limitations
- ✅ Free tier with good features

---

## 📝 Complete Vercel Deployment Checklist

- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Create `vercel.json` configuration
- [ ] Update `package.json` with build scripts
- [ ] Create `.env.production` file
- [ ] Update Socket.io configuration for Vercel
- [ ] Link GitHub repository to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Deploy (auto or manual)
- [ ] Verify deployment works
- [ ] Test WebSocket connection
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Set up custom domain (optional)

---

## 🔗 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Socket.io on Vercel**: https://socket.io/docs/v4/socket-io-on-serverless/
- **Node.js on Vercel**: https://vercel.com/docs/functions/serverless-functions/node-js

---

## 🚀 Quick Deploy Summary

```bash
# 1. Prepare
npm install

# 2. Push to GitHub
git add .
git commit -m "Deploy to Vercel"
git push origin main

# 3. Deploy with Vercel CLI
vercel --prod

# 4. Open in browser
vercel open
```

---

## ⚠️ Important Reminders

1. **WebSocket Limitations**: Vercel has serverless limitations
2. **In-Memory Data Loss**: Data resets on deployment
3. **Better Alternatives**: Railway, Render, or Fly.io are better
4. **Database**: Consider adding MongoDB for persistence
5. **Monitoring**: Use Vercel logs to debug issues

---

## 📞 Support

If you encounter issues:

1. Check Vercel logs: `vercel logs your-app-name`
2. Read Vercel docs: https://vercel.com/docs
3. Consider Railway: Better for real-time apps
4. Check Socket.io docs: https://socket.io/docs

---

**Last Updated**: January 2024
**Status**: Complete Guide for Vercel Deployment
