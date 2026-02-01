require('dotenv').config();

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
