const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const terminalManager = require('./ws');
const targetService = require('./proxmox');
const { ensureProxmoxToken } = require('./setup/proxmoxToken');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes
app.get('/api/targets', async (req, res) => {
  try {
    const targets = await targetService.getTargets();
    const safeTargets = Array.isArray(targets) ? targets : [];
    res.json({
      targets: safeTargets,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});

app.post('/api/terminal', async (req, res) => {
  const { targetId } = req.body;
  if (!targetId) {
    return res.status(400).json({ error: 'targetId required' });
  }

  const target = await targetService.getTargetById(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Target not found' });
  }

  res.json({ message: 'Use WebSocket at /ws to open terminal' });
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend not found. Ensure /frontend/index.html exists');
    }
  });
});

terminalManager.setupWebSocketServer(server);

async function startServer() {
  await ensureProxmoxToken();
  const targets = await targetService.getTargets();
  const safeTargets = Array.isArray(targets) ? targets : [];
  const PORT = config.port;
  const HOST = config.host;

  server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║     Web SSH Bastion - Backend Server Started         ║
╚════════════════════════════════════════════════════════╝

Host:     http://${HOST}:${PORT}
WebSocket: ws://${HOST}:${PORT}

Targets:
${safeTargets.map((t) => `  - ${t.name} (${t.host})`).join('\n')}

API Endpoints:
  - GET  /api/health       (server status)
  - GET  /api/targets      (list of targets)
  - POST /api/terminal     (terminal info)
  - WS   /                 (terminal WebSocket)

Ready to accept connections!
`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(1);
  });
});
