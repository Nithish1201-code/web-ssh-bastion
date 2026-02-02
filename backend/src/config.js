require('dotenv').config();

const DEFAULT_PROXMOX_TOKEN = '31293e82-d7f9-45c0-83e1-0c7ba0579e36';
const DEFAULT_TARGETS = [
  { id: 'ct-01', name: 'Container 1', host: '192.168.1.10', ip: '192.168.1.10', username: 'ubuntu', status: 'running', os: 'Ubuntu 24.04' },
  { id: 'ct-02', name: 'Container 2', host: '192.168.1.11', ip: '192.168.1.11', username: 'ubuntu', status: 'running', os: 'Ubuntu 24.04' },
  { id: 'ct-03', name: 'Container 3', host: '192.168.1.12', ip: '192.168.1.12', username: 'ubuntu', status: 'running', os: 'Ubuntu 24.04' },
];

const config = {
  get sshMode() {
    return process.env.SSH_MODE || 'mock';
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
    return process.env.PROXMOX_API_TOKEN || DEFAULT_PROXMOX_TOKEN;
  },
  get isDev() {
    return process.env.NODE_ENV !== 'production';
  },
  get defaultTargets() {
    return DEFAULT_TARGETS;
  },
  DEFAULT_PROXMOX_TOKEN,
};

module.exports = config;require('dotenv').config();

module.exports = {
  // SSH Configuration
  sshMode: process.env.SSH_MODE || 'mock',           // 'mock' for dev, 'real' for production
  sshUser: process.env.SSH_USER || 'ubuntu',
  sshKeyPath: process.env.SSH_KEY_PATH || '/keys/id_ed25519',
  sshPort: parseInt(process.env.SSH_PORT) || 22,

  // Server Configuration
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',

  // Allowed targets (CTs / VMs)
  // In production, this would come from a database or Proxmox API
  targets: [
    { id: 'ct-01', name: 'Container 1', host: '192.168.1.10' },
    { id: 'ct-02', name: 'Container 2', host: '192.168.1.11' },
    { id: 'ct-03', name: 'Container 3', host: '192.168.1.12' },
  ],

  isDev: process.env.NODE_ENV !== 'production',
};
