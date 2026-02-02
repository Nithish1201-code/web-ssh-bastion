const { ensureEnvConfig } = require('../src/setup/proxmoxToken');

ensureEnvConfig()
  .then(() => {
    console.log('Environment configuration complete.');
  })
  .catch((err) => {
    console.error('Failed to configure environment:', err);
  });
