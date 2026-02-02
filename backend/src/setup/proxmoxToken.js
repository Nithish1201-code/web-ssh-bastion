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

function validateTokenPart(value) {
  return value ? true : 'Value is required.';
}

function buildTokenValue(user, tokenName, tokenSecret) {
  return `${user}!${tokenName}=${tokenSecret}`;
}

function getDispatcher(allowInsecure) {
  if (!allowInsecure) return undefined;
  try {
    // Optional dependency, used when available.
    // eslint-disable-next-line global-require
    const { Agent } = require('undici');
    return new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
  } catch (error) {
    return undefined;
  }
}

async function testProxmoxConnection(values) {
  const url = new URL(values.PROXMOX_API_URL);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/version`;

  const allowInsecure = values.PROXMOX_API_INSECURE === '1';
  const dispatcher = getDispatcher(allowInsecure);
  const previousReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  if (allowInsecure && !dispatcher) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `PVEAPIToken=${values.PROXMOX_API_TOKEN}`,
        Accept: 'application/json',
      },
      dispatcher,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Proxmox API error ${response.status}: ${text}`);
    }

    await response.json();
    console.log('Proxmox API token verified.');
  } finally {
    if (allowInsecure && !dispatcher) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousReject || '';
    }
  }
}

async function ensureEnvConfig() {
  const existing = readEnvFile();
  const defaults = {
    SSH_USER: existing.SSH_USER || config.sshUser || 'ubuntu',
    SSH_KEY_PATH: existing.SSH_KEY_PATH || config.sshKeyPath || '/keys/id_ed25519',
    SSH_PORT: existing.SSH_PORT || String(config.sshPort || 22),
    PORT: existing.PORT || String(config.port || 3000),
    HOST: existing.HOST || config.host || 'localhost',
    PROXMOX_API_URL: existing.PROXMOX_API_URL || config.proxmoxApiUrl || 'http://127.0.0.1:8006/api2/json',
    PROXMOX_API_TOKEN: existing.PROXMOX_API_TOKEN || '',
    PROXMOX_USER: existing.PROXMOX_USER || '',
    PROXMOX_API_INSECURE: existing.PROXMOX_API_INSECURE || '1',
    PROXMOX_NODE: existing.PROXMOX_NODE || '',
    SSH_TARGETS: existing.SSH_TARGETS || '[]',
  };

  const proxmoxUser = await askForValue('Proxmox user', defaults.PROXMOX_USER, validateNonEmpty);

  let proxmoxToken = defaults.PROXMOX_API_TOKEN;
  if (!proxmoxToken) {
    const tokenName = await askForValue('Proxmox token name', '', validateTokenPart);
    const tokenSecret = await askForValue('Proxmox token secret', '', validateTokenPart);
    proxmoxToken = buildTokenValue(proxmoxUser, tokenName, tokenSecret);
  }

  const values = {
    SSH_USER: await askForValue('SSH user', defaults.SSH_USER, validateNonEmpty),
    SSH_KEY_PATH: await askForValue('SSH key path', defaults.SSH_KEY_PATH, validateNonEmpty),
    SSH_PORT: await askForValue('SSH port', defaults.SSH_PORT, validatePort),
    PORT: await askForValue('App port', defaults.PORT, validatePort),
    HOST: await askForValue('App host', defaults.HOST, validateNonEmpty),
    PROXMOX_API_URL: await askForValue('Proxmox API URL', defaults.PROXMOX_API_URL, validateUrl),
    PROXMOX_API_TOKEN: proxmoxToken,
    PROXMOX_USER: proxmoxUser,
    PROXMOX_API_INSECURE: await askForValue('Allow insecure TLS (0 or 1)', defaults.PROXMOX_API_INSECURE, validateBooleanFlag),
    PROXMOX_NODE: await askForValue('Proxmox node (optional)', defaults.PROXMOX_NODE),
    SSH_TARGETS: await askForValue('SSH targets JSON (optional)', defaults.SSH_TARGETS),
  };

  await testProxmoxConnection(values);

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

  const user = await askForValue('Proxmox user', '', validateNonEmpty);
  const tokenName = await askForValue('Proxmox token name', '', validateTokenPart);
  const tokenSecret = await askForValue('Proxmox token secret', '', validateTokenPart);
  const token = buildTokenValue(user, tokenName, tokenSecret);
  if (!token) {
    throw new Error('Missing Proxmox API token. Set PROXMOX_API_TOKEN in .env');
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
