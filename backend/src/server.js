const express = require('express');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');
const terminalManager = require('./ws');
const targetService = require('./proxmox');
const { ensureProxmoxToken } = require('./setup/proxmoxToken');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const authEnabled = config.webAuthEnabled;

// Middleware
app.use(express.json());

if (authEnabled) {
  app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    const expectedUser = config.webAuthUser || '';
    const expectedPass = config.webAuthPass || '';

    if (!expectedUser || !expectedPass) {
      return res.status(500).json({ error: 'Auth misconfigured' });
    }

    if (username !== expectedUser || password !== expectedPass) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ ok: true });
  });

  app.post('/logout', (req, res) => {
    return res.json({ ok: true });
  });
}
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

  app.post('/logout', (req, res) => {
    return res.json({ ok: true });
  });
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
