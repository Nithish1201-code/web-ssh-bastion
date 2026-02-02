const { EventEmitter } = require('events');

/**
 * MockSSHSession
 * Simulates SSH connection + PTY for development
 * In Codespaces, we don't have SSH keys, so this mocks the behavior
 */
class MockSSHSession extends EventEmitter {
  constructor(target = {}) {
    super();
    this.commandHistory = [];
    this.connected = false;
    this.target = target;

    // Simulate connection delay
    setTimeout(() => {
      this.connected = true;
      this.emit('ready');
      this.emit('data', `Welcome to Mock SSH Terminal (${target.name || 'mock'})\r\n`);
      this.emit('data', '$ ');
    }, 100);
  }

  write(data) {
    if (!this.connected) return;

    // Add command to history
    this.commandHistory.push(data);

    // Simulate command execution
    setTimeout(() => {
      // Echo the command
      this.emit('data', data);

      // Simulate output based on command
      const cmd = data.trim();
      let output = '';

      if (cmd === 'ls' || cmd === 'ls -la') {
        output = 'file1.txt\nfile2.txt\nfolder1/\n';
      } else if (cmd.startsWith('cd ')) {
        output = '';
      } else if (cmd === 'pwd') {
        output = '/home/ubuntu\n';
      } else if (cmd === 'whoami') {
        output = 'ubuntu\n';
      } else if (cmd === 'uname -a') {
        output = 'Linux mock-container 5.10.0 #1 SMP x86_64 GNU/Linux\n';
      } else if (cmd === 'clear') {
        // Clear screen
        this.emit('clear');
        output = '';
      } else if (cmd === '') {
        // Just a newline
        output = '';
      } else {
        output = `Command not found in mock: ${cmd}\n`;
      }

      if (output) {
        this.emit('data', output);
      }
      this.emit('data', '$ ');
    }, 50);
  }

  resize(cols, rows) {
    // Mock terminal resize
    this.emit('resize', { cols, rows });
  }

  end() {
    this.connected = false;
    this.emit('data', '\nConnection closed.\n');
    this.emit('close');
  }

  destroy() {
    this.end();
  }
}

module.exports = MockSSHSession;
