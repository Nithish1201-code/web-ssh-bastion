# Quick Reference

## 🚀 Run Commands

### Development (Codespaces)

```bash
cd backend
npm install
npm start
# Open: http://localhost:3000
```

### Production (Your CT)

```bash
git clone https://github.com/your-username/web-ssh-bastion.git
cd web-ssh-bastion/backend
cp .env.example .env
nano .env  # Edit with real SSH key path + targets
npm install
npm start  # SSH_MODE=real automatically
```

---

## 📂 Key Files

| File | Purpose |
| ---- | ------- |
| [backend/src/server.js](backend/src/server.js) | Express + HTTP routes |
| [backend/src/ws.js](backend/src/ws.js) | WebSocket terminal manager |
| [backend/src/config.js](backend/src/config.js) | Config loader |
| [backend/src/ssh/mock.js](backend/src/ssh/mock.js) | Mock SSH (Codespaces) |
| [backend/src/ssh/real.js](backend/src/ssh/real.js) | Real SSH (CT) |
| [frontend/index.html](frontend/index.html) | Web UI (xterm.js) |
| [backend/.env.example](backend/.env.example) | .env template |

---

## 🔧 Configuration

### .env Variables

```env
SSH_MODE=mock                    # 'mock' (dev) or 'real' (prod)
SSH_USER=ubuntu
SSH_KEY_PATH=/keys/id_ed25519
SSH_PORT=22
PORT=3000
HOST=localhost
```

### Targets (config.js)

```javascript
targets: [
  { id: 'ct-01', name: 'Web Server', host: '10.0.0.20' },
  { id: 'ct-02', name: 'Database', host: '10.0.0.30' },
],
```

---

## 📡 API Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/health` | Server status |
| GET | `/api/targets` | List containers |
| POST | `/api/terminal` | Terminal info |
| WS | `/` | WebSocket (use this!) |

---

## 💬 WebSocket Messages

### Open Terminal

```json
{ "type": "open", "targetId": "ct-01", "cols": 80, "rows": 24 }
```

### Send Input

```json
{ "type": "input", "sessionId": "...", "data": "ls\n" }
```

### Resize

```json
{ "type": "resize", "sessionId": "...", "cols": 120, "rows": 30 }
```

### Close

```json
{ "type": "close", "sessionId": "..." }
```

---

## 🔒 Security Checklist

- [ ] `.env` is in `.gitignore` ✅
- [ ] SSH keys are in `.gitignore` ✅
- [ ] No secrets in code ✅
- [ ] SSH key on CT has `chmod 600` ✅
- [ ] Only hardcoded targets allowed (no user input) ✅
- [ ] SSH user has minimal permissions ✅

---

## 🧪 Quick Tests

```bash
# Test backend health
curl http://localhost:3000/api/health

# Test targets list
curl http://localhost:3000/api/targets

# Test frontend
curl http://localhost:3000

# Test SSH on CT
ssh -i /root/.ssh/id_ed25519 ubuntu@target-ip
```

---

## 🐛 Troubleshooting

| Problem | Solution |
| ------- | -------- |
| Module not found | `npm install` |
| Port in use | `PORT=3001 npm start` |
| Connection fails | Check `curl http://localhost:3000/api/health` |
| Mock not working | Reload browser (Ctrl+Shift+R) |
| SSH connection fails | Check `.env` SSH_KEY_PATH, SSH_USER |
| Firewall blocks 3000 | Use reverse proxy (Nginx) or change HOST |

---

## 📝 Git Workflow

```bash
# Development
git add .
git commit -m "Feature: ..."
git push origin main

# On your CT
git pull origin main
npm start  # Real SSH mode
```

---

## 🎯 Workflow: Codespaces → GitHub → Your CT

```
1. Develop in Codespaces
   ├─ npm start
   └─ Test at http://localhost:3000

2. Push to GitHub
   └─ git push origin main

3. Pull on your CT
   ├─ git pull origin main
   ├─ Edit .env (real SSH keys)
   └─ npm start

Done! Real SSH terminal access.
```

---

## 📚 Learn More

- [README.md](README.md) — Full documentation
- [GETTING_STARTED.md](GETTING_STARTED.md) — Setup guide
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical deep dive

---

**Need help?** Open an issue or check documentation! 🚀
