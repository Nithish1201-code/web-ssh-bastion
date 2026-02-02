const config = require('../config');

const MOCK_TARGETS = [
  {
    id: '101',
    vmid: '101',
    node: 'lab-node',
    type: 'ct',
    name: 'web-01',
    ip: '10.0.0.10',
    host: '10.0.0.10',
    status: 'running',
    os: 'Ubuntu 24.04',
    username: config.sshUser,
  },
  {
    id: '102',
    vmid: '102',
    node: 'lab-node',
    type: 'vm',
    name: 'db-01',
    ip: '10.0.0.20',
    host: '10.0.0.20',
    status: 'stopped',
    os: 'Debian 12',
    username: config.sshUser,
  },
  {
    id: '103',
    vmid: '103',
    node: 'lab-node',
    type: 'ct',
    name: 'cache-01',
    ip: '10.0.0.30',
    host: '10.0.0.30',
    status: 'running',
    os: 'Alpine 3.20',
    username: config.sshUser,
  },
];

function fetchTargets(token) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!token && config.sshMode !== 'mock') {
        return reject(new Error('Missing Proxmox token'));
      }
      resolve(MOCK_TARGETS);
    }, 150);
  });
}

module.exports = {
  fetchTargets,
};
