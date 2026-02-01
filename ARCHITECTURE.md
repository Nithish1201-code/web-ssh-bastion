# Architecture & Development Guide

## 📐 System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Browser                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (index.html)                               │   │
│  │  • xterm.js for terminal rendering                   │   │
│  │  • Tab management                                    │   │
│  │  • WebSocket client                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTP + WebSocket
┌─────────────────────────▼──────────────────────────────────┐
│              Backend (Express + Node.js)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  server.js                                           │   │
│  │  • Express HTTP server (port 3000)                   │   │
│  │  • REST API endpoints                                │   │
│  │  • Static file serving                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ws.js (TerminalManager)                             │   │
│  │  • WebSocket server                                  │   │
│  │  • Session management                                │   │
│  │  • Event routing                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ssh/ (SSH modules)                                  │   │
│  │  • mock.js (dev/Codespaces)                          │   │
│  │  • real.js (prod/CT)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬──────────────────────────────────┘
                          │ SSH
┌─────────────────────────▼──────────────────────────────────┐
│         Proxmox Containers / Virtual Machines              │
│         (Connected via SSH keys)                           │
└───────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow: User Opens Terminal

```
1. User clicks "Container 1" button
       │
       ▼
2. Frontend sends WebSocket message:
   {
     "type": "open",
     "targetId": "ct-01",
     "cols": 80,
     "rows": 24
   }
       │
       ▼
3. Backend (ws.js) receives message
       │
       ├─ Creates session ID (unique per terminal)
       │
       └─ Loads SSH module:
           • Mock mode → new MockSSHSession()
           • Real mode → new RealSSHSession()
       │
       ▼
4. SSH module emits events:
   • 'ready' → terminal connected
   • 'data' → output to display
   • 'error' → something went wrong
   • 'close' → session ended
       │
       ▼
5. Backend sends WebSocket response:
   {
     "type": "ready",
     "sessionId": "terminal-1234567890"
   }
       │
       ▼
6. Frontend renders terminal with xterm.js
```

---

## 🔌 WebSocket Protocol

### Connection URL

```
ws://localhost:3000/   (mock mode)
ws://your-ct-ip:3000/  (prod mode)
```

### Message Types

#### From Client

**Open Terminal**

```json
{
  "type": "open",
  "targetId": "ct-01",
  "cols": 80,
  "rows": 24
}
```

**Send Input (keystroke)**

```json
{
  "type": "input",
  "sessionId": "terminal-123",
  "data": "ls\n"
}
```

**Resize Terminal**

```json
{
  "type": "resize",
  "sessionId": "terminal-123",
  "cols": 120,
  "rows": 30
}
```

**Close Session**

```json
{
  "type": "close",
  "sessionId": "terminal-123"
}
```

#### From Server

**Ready (Terminal Connected)**

```json
{
  "type": "ready",
  "sessionId": "terminal-123"
}
```

**Output (Terminal Data)**

```json
{
  "type": "output",
  "sessionId": "terminal-123",
  "data": "user@container:~$ "
}
```

**Error**

```json
{
  "type": "error",
  "sessionId": "terminal-123",
  "error": "SSH key not found"
}
```

**Close (Session Ended)**

```json
{
  "type": "close",
  "sessionId": "terminal-123"
}
```

---

## 🔐 SSH Module Architecture

### Mock Mode (Development)

**File:** [backend/src/ssh/mock.js](backend/src/ssh/mock.js)

```javascript
class MockSSHSession extends EventEmitter {
  write(data) {
    // Echo command back
    // Simulate output based on command
    // Emit 'data' event
  }
}
```

**Usage:**

- In GitHub Codespaces
- No SSH keys needed
- Simulates common commands (ls, pwd, whoami, etc.)
- Great for testing UI logic

**Events:**

- `ready` → Connection established
- `data` → Terminal output
- `close` → Connection closed
- `error` → Something failed

### Real Mode (Production)

**File:** [backend/src/ssh/real.js](backend/src/ssh/real.js)

```javascript
class RealSSHSession extends EventEmitter {
  async connect(target) {
    // Use ssh2 library to connect
    // Spawn real PTY on remote
    // Stream real terminal I/O
  }
}
```

**Usage:**

- On Proxmox control CT
- Requires SSH private key
- Real SSH connections to targets
- Full terminal capabilities

**Events:**

- Same as mock (emit/handle `ready`, `data`, `close`, `error`)

---

## ⚙️ Configuration System

**File:** [backend/src/config.js](backend/src/config.js)

```javascript
module.exports = {
  sshMode: process.env.SSH_MODE || 'mock',      // 'mock' or 'real'
  sshUser: process.env.SSH_USER || 'ubuntu',    // SSH user
  sshKeyPath: process.env.SSH_KEY_PATH || '..', // Path to private key
  sshPort: parseInt(process.env.SSH_PORT) || 22, // SSH port (usually 22)
  port: parseInt(process.env.PORT) || 3000,      // Web server port
  host: process.env.HOST || 'localhost',         // Web server host
  targets: [...],                                // List of CTs/VMs
};
```

**Load from:**

1. `.env` file (local, gitignored)
2. Environment variables
3. Hardcoded defaults

---

## 📁 File Structure

```
backend/
├── src/
│   ├── server.js          # Main entry point
│   │                       # • Express app setup
│   │                       # • HTTP routes
│   │                       # • Server startup
│   │
│   ├── ws.js              # WebSocket handler
│   │                       # • TerminalManager class
│   │                       # • Session lifecycle
│   │                       # • Message routing
│   │
│   ├── config.js          # Configuration
│   │                       # • Load .env
│   │                       # • Define targets
│   │
│   └── ssh/
│       ├── mock.js        # Mock SSH (dev)
│       │                   # • Simulates terminal
│       │                   # • No SSH needed
│       │
│       └── real.js        # Real SSH (prod)
│                           # • ssh2 library
│                           # • Real connections
│
├── package.json           # Node.js deps
├── .env.example           # Template for .env
└── .gitignore             # Don't commit .env or keys

frontend/
├── index.html             # Standalone web UI
│                           # • xterm.js integration
│                           # • Tab management
│                           # • WebSocket client
│
└── (no build step needed)
```

---

## 🔀 Mode Selection (Mock vs Real)

### How It Works

1. **Environment Variable:** `SSH_MODE=mock` or `SSH_MODE=real`
2. **config.js:** Reads from `.env`
3. **ws.js:** Checks `config.sshMode` when opening terminal
4. **Selects module:**

```javascript
if (config.sshMode === 'mock') {
  session = new MockSSHSession();
} else {
  session = new RealSSHSession(config);
}
```

### Development Flow

```
┌─────────────────────────────────────────┐
│  Codespaces (GitHub)                    │
│  .env: SSH_MODE=mock                    │
│  ↓ npm start                            │
│  ✅ Works immediately (no keys needed)   │
│  ✅ Can test UI                          │
│  ✅ Can test WebSocket logic             │
└─────────────────────────────────────────┘
           ↓ git push
┌─────────────────────────────────────────┐
│  Your Terminal (Optional)               │
│  git pull                               │
│  .env: SSH_MODE=mock                    │
│  ✅ Same as Codespaces                   │
└─────────────────────────────────────────┘
           ↓ git pull
┌─────────────────────────────────────────┐
│  Proxmox Control CT (Production)        │
│  .env: SSH_MODE=real                    │
│        SSH_KEY_PATH=/root/.ssh/...      │
│  ↓ npm start                            │
│  ✅ Real SSH connections                 │
│  ✅ Terminal access to all CTs           │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### Mock Mode (Codespaces)

- [ ] Backend starts without errors
- [ ] API endpoint `/api/health` returns 200
- [ ] API endpoint `/api/targets` returns target list
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Clicking a target opens a terminal
- [ ] Terminal accepts input (try: `ls`, `pwd`)
- [ ] Terminal displays output
- [ ] Closing tab cleans up session

### Real Mode (Control CT)

- [ ] SSH key exists: `ls ~/.ssh/id_ed25519`
- [ ] SSH key permissions: `chmod 600 ~/.ssh/id_ed25519`
- [ ] Test SSH manually: `ssh -i ~/.ssh/id_ed25519 ubuntu@target-ip`
- [ ] `.env` has `SSH_MODE=real`
- [ ] `.env` has correct `SSH_KEY_PATH`
- [ ] `.env` has correct target IPs
- [ ] Backend starts: `npm start`
- [ ] Can open terminal to real CT
- [ ] Commands execute in real container
- [ ] Multiple terminals work simultaneously

---

## 🚀 Deployment Checklist

### Before Production

- [ ] All mock tests pass
- [ ] SSH key on CT is secure (`chmod 600`)
- [ ] SSH key path in `.env` is correct
- [ ] `.env` is in `.gitignore` (not committed)
- [ ] Firewall allows port 3000 (or reverse proxy)
- [ ] Target CTs are reachable via SSH
- [ ] SSH user has minimal privileges

### Running on CT

```bash
# Clone
git clone https://github.com/your-username/web-ssh-bastion.git
cd web-ssh-bastion/backend

# Configure
cp .env.example .env
nano .env
# Set: SSH_MODE=real, SSH_KEY_PATH, targets

# Run
npm install
npm start

# Verify
curl http://localhost:3000/api/health
```

### Optional: Systemd Service

Create `/etc/systemd/system/web-ssh-bastion.service`:

```ini
[Unit]
Description=Web SSH Bastion
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/web-ssh-bastion/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10s
User=root

[Install]
WantedBy=multi-user.target
```

Start:

```bash
sudo systemctl start web-ssh-bastion
sudo systemctl enable web-ssh-bastion
```

---

## 🔮 Future Enhancements

### Phase 2: Authentication

- Add PocketBase (lightweight Postgres + auth)
- Users login before accessing terminals
- Role-based access to targets
- Audit log of terminal sessions

### Phase 3: Advanced Features

- Terminal recording/replay
- Command history & autocomplete
- Multiple panes (split terminals)
- Theme switching
- Keyboard shortcuts

### Phase 4: Integration

- Proxmox API integration (auto-discover CTs/VMs)
- Monitoring dashboard
- Alert system
- Terminal sharing

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
| ----- | ----- | --- |
| "Cannot find module" | Missing npm install | `npm install` |
| Port already in use | Another process on 3000 | `PORT=3001 npm start` |
| WebSocket connection fails | Firewall/proxy issue | Check browser DevTools |
| Mock terminal unresponsive | Browser cache | Reload page (Ctrl+Shift+R) |
| SSH connection fails | Wrong key path | Check `.env` SSH_KEY_PATH |
| Target unreachable | Target down/firewall | `ssh -i key user@target` |
| "Permission denied (publickey)" | Wrong SSH user | Check `.env` SSH_USER |

---

## 📚 References

- [ws (WebSocket library)](https://github.com/websockets/ws)
- [ssh2 (SSH library)](https://github.com/mscdex/ssh2)
- [xterm.js (Terminal UI)](https://xtermjs.org/)
- [Express.js (HTTP server)](https://expressjs.com/)

---

**Questions?** Check the README or open an issue!
