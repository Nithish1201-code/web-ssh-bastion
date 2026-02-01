const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const terminalManager = require('./ws');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes

/**
 * GET /api/targets
 * Returns list of available CTs/VMs
 */
app.get('/api/targets', (req, res) => {
  res.json({
    mode: config.sshMode,
    targets: config.targets,
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sshMode: config.sshMode,
    uptime: process.uptime(),
  });
});

/**
 * POST /api/terminal
 * Request to open a new terminal (for future REST-based UI)
 */
app.post('/api/terminal', (req, res) => {
  const { targetId } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: 'targetId required' });
  }

  const target = config.targets.find((t) => t.id === targetId);
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

// WebSocket setup
terminalManager.setupWebSocketServer(server);

// Start server
const PORT = config.port;
const HOST = config.host;

server.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Web SSH Bastion - Backend Server Started         ║
╚════════════════════════════════════════════════════════╝

Mode:     ${config.sshMode}
Host:     http://${HOST}:${PORT}
WebSocket: ws://${HOST}:${PORT}

Targets:
${config.targets.map((t) => `  - ${t.name} (${t.host})`).join('\n')}

API Endpoints:
  - GET  /api/health       (server status)
  - GET  /api/targets      (list of targets)
  - POST /api/terminal     (terminal info)
  - WS   /                 (terminal WebSocket)

Ready to accept connections!
`);
});

// Graceful shutdown
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
    process.exit(0);
  });
});
