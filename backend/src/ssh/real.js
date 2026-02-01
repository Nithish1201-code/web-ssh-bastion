const { Client: SSHClient } = require('ssh2');
const { spawn } = require('node-pty');
const fs = require('fs');
const { EventEmitter } = require('events');

/**
 * RealSSHSession
 * Real SSH connection using ssh2 + node-pty
 * Used in production on the control CT
 */
class RealSSHSession extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.sshClient = null;
    this.pty = null;
    this.connected = false;
  }

  connect(target) {
    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient();

      // SSH connection options
      const sshConfig = {
        host: target.host,
        port: this.config.sshPort,
        username: this.config.sshUser,
        privateKey: fs.readFileSync(this.config.sshKeyPath),
        algorithms: {
          serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa'],
        },
      };

      this.sshClient.on('ready', () => {
        this.connected = true;
        this.emit('ready');
        resolve();
      });

      this.sshClient.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.sshClient.on('close', () => {
        this.connected = false;
        this.emit('close');
      });

      this.sshClient.connect(sshConfig);
    });
  }

  write(data) {
    if (!this.pty) return;
    this.pty.write(data);
  }

  resize(cols, rows) {
    if (this.pty) {
      this.pty.resize(cols, rows);
    }
  }

  end() {
    if (this.pty) {
      this.pty.destroy();
    }
    if (this.sshClient) {
      this.sshClient.end();
    }
    this.emit('close');
  }

  destroy() {
    this.end();
  }
}

module.exports = RealSSHSession;
