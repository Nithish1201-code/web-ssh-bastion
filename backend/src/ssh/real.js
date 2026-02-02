const { Client: SSHClient } = require('ssh2');
const fs = require('fs');
const crypto = require('crypto');
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

  connect(target, auth = {}) {
    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient();

      const acceptHostKey = auth.acceptHostKey === true;
      const password = auth.password || '';
      const hasKey = this.config.sshKeyPath && fs.existsSync(this.config.sshKeyPath);

      if (!hasKey && !password) {
        const error = new Error('Missing SSH credentials: provide password or SSH key.');
        error.code = 'NO_AUTH';
        this.emit('error', error);
        reject(error);
        return;
      }

      let hostKeyRejected = false;
      const hostVerifier = (key) => {
        if (acceptHostKey) {
          return true;
        }
        if (!hostKeyRejected) {
          const fingerprint = `SHA256:${crypto.createHash('sha256').update(key).digest('base64')}`;
          const error = new Error('Host key not accepted');
          error.code = 'HOSTKEY';
          error.fingerprint = fingerprint;
          hostKeyRejected = true;
          this.emit('error', error);
        }
        return false;
      };

      // SSH connection options
      const sshConfig = {
        host: target.host,
        port: this.config.sshPort,
        username: this.config.sshUser,
        hostVerifier,
        algorithms: {
          serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa'],
        },
      };

      if (hasKey) {
        sshConfig.privateKey = fs.readFileSync(this.config.sshKeyPath);
      }

      if (password) {
        sshConfig.password = password;
      }

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
