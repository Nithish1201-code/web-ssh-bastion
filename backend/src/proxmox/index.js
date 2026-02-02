const config = require('../config');
const mockClient = require('./mock');
const realClient = require('./real');

async function getTargets() {
  if (config.sshMode === 'mock') {
    return mockClient.fetchTargets(config.proxmoxToken);
  }
  return realClient.fetchTargets();
}

async function getTargetById(targetId) {
  const targets = await getTargets();
  return targets.find((target) => target.id === targetId);
}

module.exports = {
  getTargets,
  getTargetById,
};
