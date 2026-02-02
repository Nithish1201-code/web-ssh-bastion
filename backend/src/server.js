const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const config = require('./config');
const terminalManager = require('./ws');
const targetService = require('./proxmox');
const { ensureProxmoxToken } = require('./setup/proxmoxToken');

const app = express();
const server = http.createServer(app);
const sessionSecret = process.env.WEB_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware
app.use(express.json());

const parseCookies = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key) return acc;
      acc[key] = rest.join('=');
      return acc;
    }, {});

const signToken = (token) =>
  crypto.createHmac('sha256', sessionSecret).update(token).digest('hex');

const verifyToken = (token, sig) => {
  if (!token || !sig) return false;
  const expected = signToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch (error) {
    return false;
  }
};

const buildSessionCookie = (token) => {
  const sig = signToken(token);
  return `webssh_session=${token}.${sig}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
};

const authEnabled = config.webAuthEnabled;

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

    const token = crypto.randomBytes(24).toString('hex');
    res.setHeader('Set-Cookie', buildSessionCookie(token));
    return res.json({ ok: true, token });
  });

  app.post('/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    res.setHeader('Set-Cookie', 'webssh_session=; Max-Age=0; Path=/');
    return res.json({ ok: true });
  });

  app.use((req, res, next) => {
    if (req.path === '/login') return next();
    if (req.path === '/login.html') return next();
    if (req.path.startsWith('/vendor/')) return next();
    if (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.svg')) return next();

    if (req.query?.session) {
      const sessionToken = req.query.session;
      res.setHeader('Set-Cookie', buildSessionCookie(sessionToken));
      return res.redirect('/');
    }

    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.webssh_session) {
      const rawValue = decodeURIComponent(cookies.webssh_session);
      if (rawValue.includes('.')) {
        const [token, sig] = rawValue.split('.');
        if (verifyToken(token, sig)) {
          return next();
        }
      } else {
        res.setHeader('Set-Cookie', buildSessionCookie(rawValue));
        return next();
      }
    }

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    return res.sendFile(path.join(__dirname, '../../frontend/login.html'));
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});

app.get('/api/build', (req, res) => {
  try {
    const repoRoot = path.join(__dirname, '../..');
    const build = execSync('git rev-list --count HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    res.json({ build });
  } catch (error) {
    res.json({ build: 'unknown' });
  }
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
