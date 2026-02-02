const { Client: SSHClient } = require('ssh2');
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
    this.stream = null;
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
        this.sshClient.shell(
          {
            term: 'xterm-256color',
            cols: 80,
            rows: 24,
          },
          (err, stream) => {
            if (err) {
              this.emit('error', err);
              reject(err);
              return;
            }
            this.stream = stream;
            stream.on('data', (data) => this.emit('data', data));
            stream.on('close', () => {
              this.connected = false;
              this.emit('close');
            });
            this.emit('ready');
            resolve();
          }
        );
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
    if (!this.stream) return;
    this.stream.write(data);
  }

  resize(cols, rows) {
    if (this.stream && this.stream.setWindow) {
      this.stream.setWindow(rows, cols, rows * 14, cols * 7);
    }
  }

  end() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
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
