const config = require('../config');

const MOCK_TARGETS = [
  {
    id: '101',
    name: 'web-01',
    ip: '10.0.0.10',
    host: '10.0.0.10',
    status: 'running',
    os: 'Ubuntu 24.04',
    username: 'root',
  },
  {
    id: '102',
    name: 'db-01',
    ip: '10.0.0.20',
    host: '10.0.0.20',
    status: 'stopped',
    os: 'Debian 12',
    username: 'root',
  },
  {
    id: '103',
    name: 'cache-01',
    ip: '10.0.0.30',
    host: '10.0.0.30',
    status: 'running',
    os: 'Alpine 3.20',
    username: 'root',
  },
];

function fetchTargets(token) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (token !== config.DEFAULT_PROXMOX_TOKEN) {
        return reject(new Error('Invalid Proxmox token')); 
      }
      resolve(MOCK_TARGETS);
    }, 150);
  });
}

module.exports = {
  fetchTargets,
};
