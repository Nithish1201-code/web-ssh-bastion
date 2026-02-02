const realClient = require('./real');

async function getTargets() {
  const targets = await realClient.fetchTargets();
  return Array.isArray(targets) ? targets : [];
}

async function getTargetById(targetId) {
  const targets = await getTargets();
  return targets.find((target) => target.id === targetId);
}

module.exports = {
  getTargets,
  getTargetById,
};
