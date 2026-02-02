# Getting Started: Web SSH Bastion

## ✅ What You Have Now

A fully working **self-hosted SSH terminal web app** with:

- ✅ Mock SSH (for Codespaces dev)
- ✅ Real SSH (for your CT prod)
- ✅ WebSocket streaming
- ✅ Multi-terminal UI
- ✅ Clean, modern interface
- ✅ Ready to push to GitHub

---

## 🚀 Step 1: Start in Codespaces

### Open Codespaces

1. Go to GitHub repo → **Code** → **Codespaces** → **Create**
2. Wait for environment to load (~1 min)

### Run Backend

```bash
cd backend
npm install
npm run setup   # prompt for mock Proxmox token
npm run dev     # nodemon-backed server
```

The `npm run setup` command stores the mock Proxmox token (`31293e82-d7f9-45c0-83e1-0c7ba0579e36`) in `.env`, which the backend uses to fetch the dynamic CT/VM list.

You'll see:

```
╔════════════════════════════════════════════════════════╗
║     Web SSH Bastion - Backend Server Started         ║
╚════════════════════════════════════════════════════════╝

Mode:     mock
Host:     http://localhost:3000
WebSocket: ws://localhost:3000

Ready to accept connections!
```

### Open in Browser

1. Codespaces automatically detects port 3000
2. Click **"Open in Browser"** or go to Codespaces URL
3. You'll see the web UI with 3 containers listed

### Try a Terminal

1. Click **"Container 1"**
2. You'll see a terminal appear
3. Type: `ls`, `pwd`, `whoami`
4. Try `clear` to clear screen

---

## 📝 Step 2: Push to GitHub

```bash
# From any terminal (Codespaces or local)
git add .
git commit -m "Initial: mock SSH backend + web UI"
git push origin main
```

Your repo is now **public** and safe:

- ✅ `.env` is gitignored (secrets safe)
- ✅ `mock.js` doesn't need SSH keys
- ✅ Anyone can clone and develop

---

## 🖥️ Step 3: Deploy to Your Control CT

### On Your Control Container

```bash
# Clone the repo
cd ~/projects
git clone https://github.com/your-username/web-ssh-bastion.git
cd web-ssh-bastion/backend

# Copy environment template
cp .env.example .env

# Edit with real values
nano .env
```

Edit `.env` with your real settings:

```env
SSH_MODE=real                                    # Switch to real SSH!
SSH_USER=ubuntu
SSH_KEY_PATH=/root/.ssh/id_ed25519              # Your actual SSH key
SSH_PORT=22
PORT=3000
HOST=0.0.0.0                                     # Or specific IP
```

### Update Targets

In [backend/src/config.js](backend/src/config.js), update the `targets` array with your actual CTs:

```javascript
targets: [
  { id: 'web-01', name: 'Web Server', host: '10.0.0.20' },
  { id: 'db-01', name: 'Database', host: '10.0.0.30' },
  { id: 'cache-01', name: 'Cache', host: '10.0.0.40' },
],
```

### Start Server

```bash
npm install
npm start
```

Now **real SSH connections** work! Open in browser at `http://your-ct-ip:3000`.

---

## 🔄 Typical Workflow (Codespaces → CT)

```
┌─────────────────────┐
│  GitHub (public)    │  <- Code only, no secrets
│                     │
└──────────┬──────────┘
           │ git clone
┌──────────▼──────────┐
│   Codespaces (dev)  │  <- Test mock SSH here
│  SSH_MODE=mock      │
│  npm start          │
└──────────┬──────────┘
           │ git pull
┌──────────▼──────────┐
│   Control CT (prod) │  <- Real SSH here
│  SSH_MODE=real      │
│  .env with real key │
│  npm start          │
└─────────────────────┘
```

### Example Session

**Codespaces:**

```bash
# Develop + test
cd backend && npm start
# Click "Container 1", type "ls"
# See mock output
```

**GitHub:**

```bash
git add .
git commit -m "Feature: add terminal resize"
git push origin main
```

**Your CT:**

```bash
git pull origin main
npm start
# Production is updated! Real SSH works.
```

---

## 🆘 Troubleshooting

### "Cannot find module" error

```bash
npm install
```

### Port 3000 already in use

```bash
# Find process
lsof -i :3000

# Or use different port
PORT=3001 npm start
```

### Mock terminal not responding

- Try refreshing browser
- Check browser console (F12)
- Verify backend is running: `curl http://localhost:3000/api/health`

### Real SSH not working (on CT)

Check:

1. SSH key path is correct: `ls /root/.ssh/id_ed25519`
2. SSH key has right permissions: `chmod 600 /root/.ssh/id_ed25519`
3. Target host is reachable: `ssh -i /root/.ssh/id_ed25519 ubuntu@10.0.0.20`
4. `.env` says `SSH_MODE=real`

---

## 📚 Next Steps

Once you're comfortable:

1. **Add more targets** → Edit `config.js` or add env var
2. **Add authentication** → Use PocketBase (Phase 2)
3. **Custom styling** → Modify `frontend/index.html`
4. **SSH settings** → Tweak `backend/src/ssh/real.js`
5. **Proxmox API** → Auto-discover CTs instead of hardcoding

---

## 🎓 Architecture Recap

```
Frontend (index.html)
    ↓ WebSocket (ws://)
Backend (Express + ws)
    ├─ Mock SSH (mock.js)      [Codespaces]
    └─ Real SSH (real.js)      [Control CT]
        ↓ SSH
    Proxmox CTs / VMs
```

**The key insight:**

- Same code everywhere
- **Mock mode** for safe dev (Codespaces, no keys needed)
- **Real mode** for prod (Control CT, SSH key required)
- `.env` controls which mode

---

## ✨ You're Ready!

1. ✅ Backend works (you tested it)
2. ✅ Frontend works (try it in browser)
3. ✅ Mock SSH works (test in Codespaces)
4. ✅ Code is ready to push
5. ✅ Ready to deploy to CT (when you're ready)

**Next thing to do?** Pick one:

- [ ] Add more containers to `config.js`
- [ ] Test real SSH on your CT
- [ ] Add authentication (PocketBase)
- [ ] Set up a reverse proxy (Nginx)
- [ ] Deploy to public domain

---

**Questions?** Check [README.md](README.md) for API docs, or start an issue on GitHub!
