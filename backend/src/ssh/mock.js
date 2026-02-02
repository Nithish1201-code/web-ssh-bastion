module.exports = class RemovedMockSSHSession {
  constructor() {
    throw new Error('Mock SSH has been removed. Use real SSH only.');
  }
};
