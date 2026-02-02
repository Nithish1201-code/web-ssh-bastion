require('dotenv').config();

const config = {
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
    return process.env.PROXMOX_API_URL || 'http://127.0.0.1:8006/api2/json';
  },
  get proxmoxToken() {
    return process.env.PROXMOX_API_TOKEN || '';
  },
  get proxmoxInsecure() {
    return (process.env.PROXMOX_API_INSECURE || '1') === '1';
  },
  get proxmoxNode() {
    return process.env.PROXMOX_NODE || '';
  },
  get webAuthEnabled() {
    return (process.env.WEB_AUTH_ENABLED || '0') === '1';
  }
  get webAuthUser() {
    return process.env.WEB_AUTH_USER || '';
  }
  get webAuthPass() {
    return process.env.WEB_AUTH_PASS || '';
  }
  get isDev() {
    return process.env.NODE_ENV !== 'production';
  },
};

module.exports = config;
