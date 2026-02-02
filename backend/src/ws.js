const WebSocket = require('ws');
const RealSSHSession = require('./ssh/real');
const config = require('./config');
const targetService = require('./proxmox');

/**
 * WebSocket Terminal Manager
 * Handles WebSocket connections and manages SSH sessions
 */
class TerminalManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> SSHSession
    this.wsConnections = new Map(); // ws -> sessionId
  }

  createSession(target, preferredSessionId) {
    let sessionId = preferredSessionId;
    while (!sessionId || this.sessions.has(sessionId)) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const session = new RealSSHSession(config);

    this.sessions.set(sessionId, session);
    return { sessionId, session };
  }

  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.destroy();
      this.sessions.delete(sessionId);
    }
  }

  setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', async (message) => {
        try {
          const msg = JSON.parse(message);
          if (msg?.type && msg?.targetId) {
            console.log('[WS] Message', { type: msg.type, targetId: msg.targetId, sessionId: msg.sessionId });
          } else if (msg?.type) {
            console.log('[WS] Message', { type: msg.type, sessionId: msg.sessionId });
          }

          if (msg.type === 'open') {
            // Open new SSH terminal
            const { targetId, cols, rows, sessionId: preferredSessionId, password, acceptHostKey } = msg;
            console.log('[WS] Open terminal request', {
              targetId,
              cols,
              rows,
              hasPassword: Boolean(password),
              acceptHostKey: Boolean(acceptHostKey),
            });
            const target = await targetService.getTargetById(targetId);
            if (!target) {
              console.warn('[WS] Target not found', { targetId });
              ws.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Target not found',
                })
              );
              return;
            }

            const { sessionId, session } = this.createSession(target, preferredSessionId);
            console.log('[WS] Session created', { sessionId, targetId: target.id });

            this.wsConnections.set(ws, sessionId);

            // Set up event listeners
            session.on('ready', () => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(
                JSON.stringify({
                  type: 'ready',
                  sessionId,
                })
              );
            });

            session.on('data', (data) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(
                JSON.stringify({
                  type: 'output',
                  sessionId,
                  data: data.toString(),
                })
              );
            });

            session.on('error', (err) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(
                JSON.stringify({
                  type: 'error',
                  sessionId,
                  error: err.message,
                  code: err.code,
                  fingerprint: err.fingerprint,
                })
              );
            });

            session.on('close', () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'close',
                    sessionId,
                  })
                );
              }
              this.removeSession(sessionId);
            });

            await session.connect(target, { password, acceptHostKey });
            console.log('[WS] Session connect resolved', { sessionId, targetId: target.id });
          } else if (msg.type === 'input') {
            // Send input to SSH session
            const { sessionId, data } = msg;
            const session = this.sessions.get(sessionId);
            if (session) {
              session.write(data);
            }
          } else if (msg.type === 'resize') {
            // Resize terminal
            const { sessionId, cols, rows } = msg;
            const session = this.sessions.get(sessionId);
            if (session) {
              session.resize(cols, rows);
            }
          } else if (msg.type === 'close') {
            // Close session
            const { sessionId } = msg;
            this.removeSession(sessionId);
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
          console.error('[WS] Raw message:', message.toString());
          ws.send(
            JSON.stringify({
              type: 'error',
              error: err.message,
            })
          );
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        const sessionId = this.wsConnections.get(ws);
        if (sessionId) {
          console.log('[WS] Closing session from socket close', { sessionId });
          this.removeSession(sessionId);
          this.wsConnections.delete(ws);
        }
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });

    return wss;
  }
}

module.exports = new TerminalManager();
