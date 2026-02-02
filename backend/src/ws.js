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

  createSession(target) {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

          if (msg.type === 'open') {
            // Open new SSH terminal
            const { targetId, cols, rows } = msg;
            const target = await targetService.getTargetById(targetId);
            if (!target) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Target not found',
                })
              );
              return;
            }

            const { sessionId, session } = this.createSession(target);

            this.wsConnections.set(ws, sessionId);

            // Set up event listeners
            session.on('ready', () => {
              ws.send(
                JSON.stringify({
                  type: 'ready',
                  sessionId,
                })
              );
            });

            session.on('data', (data) => {
              ws.send(
                JSON.stringify({
                  type: 'output',
                  sessionId,
                  data: data.toString(),
                })
              );
            });

            session.on('error', (err) => {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  sessionId,
                  error: err.message,
                })
              );
            });

            session.on('close', () => {
              ws.send(
                JSON.stringify({
                  type: 'close',
                  sessionId,
                })
              );
              this.removeSession(sessionId);
            });

            await session.connect(target);
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
