const fs = require('fs');
require('dotenv').config();

const DEFAULT_TARGETS = [
  {
    id: 'ct-01',
    name: 'Container 1',
    host: '192.168.1.10',
    ip: '192.168.1.10',
    username: 'ubuntu',
    status: 'running',
    os: 'Ubuntu 24.04',
    type: 'ct',
    node: 'node-1',
    vmid: '101',
  },
  {
    id: 'ct-02',
    name: 'Container 2',
    host: '192.168.1.11',
    ip: '192.168.1.11',
    username: 'ubuntu',
    status: 'running',
    os: 'Ubuntu 24.04',
    type: 'ct',
    node: 'node-1',
    vmid: '102',
  },
  {
    id: 'ct-03',
    name: 'Container 3',
    host: '192.168.1.12',
    ip: '192.168.1.12',
    username: 'ubuntu',
    status: 'running',
    os: 'Ubuntu 24.04',
    type: 'ct',
    node: 'node-1',
    vmid: '103',
  },
];

function isLikelyLxc() {
  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
    if (cgroup.includes('lxc') || cgroup.includes('pve')) {
      return true;
    }
  } catch (error) {
    // ignore
  }

  try {
    const environ = fs.readFileSync('/proc/1/environ', 'utf8');
    if (environ.includes('container=lxc')) {
      return true;
    }
  } catch (error) {
    // ignore
  }

  return false;
}

function detectSshMode() {
  if (process.env.SSH_MODE) {
    return process.env.SSH_MODE;
  }

  return isLikelyLxc() ? 'real' : 'mock';
}

const config = {
  get sshMode() {
    return detectSshMode();
  },
  get sshUser() {
    return process.env.SSH_USER || 'ubuntu';
  },
  get sshKeyPath() {
    return process.env.SSH_KEY_PATH || '/keys/id_ed25519';
  },
  get sshPort() {
    return parseInt(process.env.SSH_PORT, 10) || 22;
  },
  get port() {
    return parseInt(process.env.PORT, 10) || 3000;
  },
  get host() {
    return process.env.HOST || 'localhost';
  },
  get proxmoxApiUrl() {
    return process.env.PROXMOX_API_URL || 'https://proxmox.local/api2/json';
  },
  get proxmoxToken() {
    return process.env.PROXMOX_API_TOKEN || '';
  },
  get proxmoxInsecure() {
    return process.env.PROXMOX_API_INSECURE === '1';
  },
  get proxmoxNode() {
    return process.env.PROXMOX_NODE || '';
  },
  get isDev() {
    return process.env.NODE_ENV !== 'production';
  },
  get defaultTargets() {
    return DEFAULT_TARGETS;
  },
};

module.exports = config;
