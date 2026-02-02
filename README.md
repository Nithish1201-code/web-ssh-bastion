# Web SSH Bastion

A self-hosted web application for opening browser-based SSH terminals to multiple Proxmox containers and VMs from one dashboard.

## 🎯 Features

- **Multiple Terminals**: Open multiple SSH sessions simultaneously in separate tabs
- **Mock Mode (Dev)**: Test in GitHub Codespaces without SSH keys
- **Real Mode (Prod)**: Switch to real SSH connections on your control container
- **Web UI**: Clean, modern terminal interface with xterm.js
- **WebSocket Streaming**: Real-time terminal I/O over WebSockets
- **No Passwords**: SSH key-based authentication only

## 📋 Project Structure

```
web-ssh-bastion/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express + WebSocket server
│   │   ├── ws.js              # WebSocket terminal manager
│   │   ├── config.js          # Configuration loader
│   │   └── ssh/
│   │       ├── mock.js        # Mock SSH for dev (Codespaces)
│   │       └── real.js        # Real SSH for prod (Control CT)
│   ├── package.json
│   └── .env.example
├── frontend/
│   └── index.html             # Standalone HTML + JS + xterm.js
└── README.md
```

## 🚀 Quick Start

### 1. Clone & Setup (GitHub Codespaces)

```bash
# Codespaces automatically clones the repo
cd /workspaces/web-ssh-bastion/backend

# Install dependencies
npm install  # Install dependencies (runs setup script)

# Start backend (mock mode by default)
npm run setup  # Prompt for mock Proxmox token & save to .env
npm run dev    # Start backend (mock mode by default)
```

### 2. Access in Browser

Open Codespaces in your browser, and VS Code will automatically forward port 3000.

- **App**: `http://localhost:3000` (or your Codespaces URL)
- **API**: `http://localhost:3000/api/health`

### 3. Try Mock Terminal

1. Click any **"Container"** button in the sidebar
2. You'll see a fake SSH terminal
3. Try: `ls`, `pwd`, `whoami`, `clear`

## 🔧 Configuration

Create `.env` in `backend/` (copy from `.env.example`):

```env
SSH_MODE=mock                    # 'mock' for dev, 'real' for production
SSH_USER=ubuntu
SSH_KEY_PATH=/keys/id_ed25519
SSH_PORT=22
PORT=3000
HOST=localhost
```

### Proxmox API Token (Mock)

Codespaces development uses a mock Proxmox API token. Run `npm run setup` after installing dependencies and enter the default token (`31293e82-d7f9-45c0-83e1-0c7ba0579e36`) when prompted. The script saves it to `.env` so the backend can fetch the mocked CTs/VMs via `/api/targets`.

On your Proxmox control node, create an `.env` with your real token/URL and rerun `npm run setup` if you need to refresh the stored value.

### Mock vs Real Mode

| Mode | Location | SSH Keys | Use Case |
| ---- | -------- | -------- | -------- |
| `mock` | Codespaces | Not needed | Development, testing |
| `real` | Control CT | Required | Production |

**Switching to Real SSH** (on your control CT):

```bash
# After cloning to your CT
git clone https://github.com/your-username/web-ssh-bastion.git
cd web-ssh-bastion/backend

# Create .env with real SSH keys
cp .env.example .env
# Edit .env:
#  SSH_MODE=real
#  SSH_KEY_PATH=/path/to/your/ssh/key
#  SSH_TARGETS=[{"id":"ct-01","name":"Container 1","host":"192.168.1.10"}]

npm install
npm start
```

## 🌐 API Endpoints

### REST API

- **GET** `/api/health` — Server status
- **GET** `/api/targets` — List available containers/VMs
- **POST** `/api/terminal` — Terminal info (REST endpoint, WebSocket preferred)

### WebSocket (ws://localhost:3000)

#### Messages From Client

```json
{
  "type": "open",
  "targetId": "ct-01",
  "cols": 80,
  "rows": 24
}

{
  "type": "input",
  "sessionId": "...",
  "data": "ls\n"
}

{
  "type": "resize",
  "sessionId": "...",
  "cols": 120,
  "rows": 30
}

{
  "type": "close",
  "sessionId": "..."
}
```

#### Messages From Server

```json
{
  "type": "ready",
  "sessionId": "..."
}

{
  "type": "output",
  "sessionId": "...",
  "data": "user@container:~$ "
}

{
  "type": "error",
  "sessionId": "...",
  "error": "Connection failed"
}

{
  "type": "close",
  "sessionId": "..."
}
```

## 🔐 Security

### Current (Phase 1)

- Localhost only
- No authentication
- SSH keys on control CT only
- Mock mode for Codespaces dev

### Phase 2 (Future)

- HTTPS + TLS
- PocketBase JWT authentication
- Role-based access control
- Public expose with reverse proxy

## 📚 Development Workflow

### GitHub → Codespaces (Dev)

```bash
# In Codespaces
cd backend
npm start
# Test at http://localhost:3000
```

### Push to GitHub

```bash
git add .
git commit -m "Feature: ..."
git push origin main
```

### Deploy to Control CT (Prod)

```bash
# On your CT
git clone https://github.com/your-username/web-ssh-bastion.git
cd web-ssh-bastion/backend

# Create .env with real SSH keys
cp .env.example .env
nano .env  # Edit with real values

npm install
npm start  # Starts with SSH_MODE=real
```

## 🧪 Testing

### Backend Only

```bash
cd backend
npm start
# Test endpoints:
curl http://localhost:3000/api/health
curl http://localhost:3000/api/targets
```

### Frontend + Backend

1. Start backend (`npm start`)
2. Open http://localhost:3000 in browser
3. Click a container button
4. Type commands in the terminal

## 📝 Common Commands (Mock Terminal)

```bash
ls              # List files
pwd             # Current directory
whoami          # Current user
uname -a        # System info
clear           # Clear screen
```

## 🐛 Troubleshooting

### "Cannot find module 'ws'"

```bash
npm install
```

### Port 3000 already in use

```bash
# Find what's using it
lsof -i :3000

# Or change PORT in .env
PORT=3001 npm start
```

### WebSocket connection fails

- Check browser console for errors
- Ensure backend is running
- Try `curl http://localhost:3000/api/health`

### Mock terminal not responding

- Reload page
- Check backend logs
- Mock session only echoes specific commands (ls, pwd, etc.)

## 📦 Dependencies

- **express** — HTTP server
- **ws** — WebSocket server
- **node-pty** — PTY (pseudo-terminal)
- **ssh2** — SSH client
- **dotenv** — Environment configuration

## 🎓 Future Enhancements

- [ ] Proxmox API integration (auto-discover CTs/VMs)
- [ ] Terminal recording/playback
- [ ] Session persistence
- [ ] Multiple users + authentication
- [ ] Terminal splitting (split-pane)
- [ ] Command history & autocomplete
- [ ] Dark/light theme toggle

## 📄 License

ISC

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am "Add feature"`
3. Push to GitHub: `git push origin feature/your-feature`
4. Open a Pull Request

---

**Questions?** Check the issues or start a discussion!
