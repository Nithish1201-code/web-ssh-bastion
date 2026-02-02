const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config');

const ENV_PATH = path.resolve(__dirname, '../../.env');
const TOKEN_KEY = 'PROXMOX_API_TOKEN';

function parseEnvContent(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (!key || rest.length === 0) return acc;
      acc[key.trim()] = rest.join('=').trim();
      return acc;
    }, {});
}

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return {};
  }
  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  return parseEnvContent(envContent);
}

function writeEnvFile(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function askForValue(prompt, defaultValue = '', validate) {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [default: ${defaultValue}]` : '';
  const question = `${prompt}${suffix}: `;

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(question, (answer) => {
        const trimmed = answer.trim() || defaultValue;
        if (validate) {
          const result = validate(trimmed);
          if (result !== true) {
            console.log(result || 'Invalid value. Try again.');
            return ask();
          }
        }
        rl.close();
        resolve(trimmed);
      });
    };
    ask();
  });
}

function validateNonEmpty(value) {
  return value ? true : 'Value is required.';
}

function validatePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Port must be a number between 1 and 65535.';
  }
  return true;
}

function validateSshMode(value) {
  return ['mock', 'real'].includes(value) ? true : 'SSH mode must be mock or real.';
}

function validateBooleanFlag(value) {
  return ['0', '1'].includes(value) ? true : 'Use 0 or 1.';
}

function validateUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol.startsWith('http') ? true : 'URL must start with http or https.';
  } catch (error) {
    return 'Invalid URL.';
  }
}

async function ensureEnvConfig() {
  const existing = readEnvFile();
  const defaults = {
    SSH_MODE: existing.SSH_MODE || config.sshMode || 'mock',
    SSH_USER: existing.SSH_USER || config.sshUser || 'ubuntu',
    SSH_KEY_PATH: existing.SSH_KEY_PATH || config.sshKeyPath || '/keys/id_ed25519',
    SSH_PORT: existing.SSH_PORT || String(config.sshPort || 22),
    PORT: existing.PORT || String(config.port || 3000),
    HOST: existing.HOST || config.host || 'localhost',
    PROXMOX_API_URL: existing.PROXMOX_API_URL || config.proxmoxApiUrl || '',
    PROXMOX_API_TOKEN: existing.PROXMOX_API_TOKEN || '',
    PROXMOX_USER: existing.PROXMOX_USER || '',
    PROXMOX_API_INSECURE: existing.PROXMOX_API_INSECURE || '0',
    PROXMOX_NODE: existing.PROXMOX_NODE || '',
    SSH_TARGETS: existing.SSH_TARGETS || '[]',
  };

  const values = {
    SSH_MODE: await askForValue('SSH mode (mock or real)', defaults.SSH_MODE, validateSshMode),
    SSH_USER: await askForValue('SSH user', defaults.SSH_USER, validateNonEmpty),
    SSH_KEY_PATH: await askForValue('SSH key path', defaults.SSH_KEY_PATH, validateNonEmpty),
    SSH_PORT: await askForValue('SSH port', defaults.SSH_PORT, validatePort),
    PORT: await askForValue('App port', defaults.PORT, validatePort),
    HOST: await askForValue('App host', defaults.HOST, validateNonEmpty),
    PROXMOX_API_URL: await askForValue('Proxmox API URL', defaults.PROXMOX_API_URL, validateUrl),
    PROXMOX_API_TOKEN: await askForValue('Proxmox API token', defaults.PROXMOX_API_TOKEN),
    PROXMOX_USER: await askForValue('Proxmox user (optional)', defaults.PROXMOX_USER),
    PROXMOX_API_INSECURE: await askForValue('Allow insecure TLS (0 or 1)', defaults.PROXMOX_API_INSECURE, validateBooleanFlag),
    PROXMOX_NODE: await askForValue('Proxmox node (optional)', defaults.PROXMOX_NODE),
    SSH_TARGETS: await askForValue('SSH targets JSON (optional)', defaults.SSH_TARGETS),
  };

  writeEnvFile(values);
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = value;
  });

  console.log(`Saved configuration to ${ENV_PATH}`);
  return values;
}

async function ensureProxmoxToken() {
  if (process.env.PROXMOX_API_TOKEN) {
    return process.env.PROXMOX_API_TOKEN;
  }

  const token = await askForValue('Proxmox API token', '');
  if (!token) {
    if (config.sshMode === 'real') {
      throw new Error('Missing Proxmox API token. Set PROXMOX_API_TOKEN in .env');
    }
    return '';
  }

  process.env.PROXMOX_API_TOKEN = token;
  try {
    const existing = readEnvFile();
    existing[TOKEN_KEY] = token;
    writeEnvFile(existing);
    console.log(`Saved Proxmox API token to ${ENV_PATH}`);
  } catch (error) {
    console.warn('Unable to persist Proxmox token to .env:', error.message);
  }
  return token;
}

module.exports = {
  ensureEnvConfig,
  ensureProxmoxToken,
};
