const { ensureProxmoxToken } = require('../src/setup/proxmoxToken');

ensureProxmoxToken()
  .then(() => {
    console.log('Proxmox API token setup complete.');
  })
  .catch((err) => {
    console.error('Failed to ensure Proxmox token:', err);
  });
