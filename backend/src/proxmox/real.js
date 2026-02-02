const config = require('../config');

async function fetchTargets() {
  // Placeholder for when the control CT supplies a real Proxmox API
  return config.defaultTargets;
}

module.exports = {
  fetchTargets,
};
