const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config');

const ENV_PATH = path.resolve(__dirname, '../../.env');
const TOKEN_KEY = 'PROXMOX_API_TOKEN';

function writeTokenToEnv(token) {
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }

  const lines = envContent.length ? envContent.split('\n') : [];
  const updated = lines.reduce((acc, line) => {
    if (line.startsWith(`${TOKEN_KEY}=`)) {
      acc.push(`${TOKEN_KEY}=${token}`);
    } else {
      acc.push(line);
    }
    return acc;
  }, []);

  if (!updated.some((line) => line.startsWith(`${TOKEN_KEY}=`))) {
    updated.push(`${TOKEN_KEY}=${token}`);
  }

  fs.writeFileSync(ENV_PATH, `${updated.join('\n')}\n`, 'utf8');
}

function askForToken(defaultToken) {
  if (!process.stdin.isTTY) {
    console.log(`No interactive shell detected; using default Proxmox token: ${defaultToken}`);
    return Promise.resolve(defaultToken);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`Enter your Proxmox API token [default: ${defaultToken}]: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultToken);
    });
  });
}

async function ensureProxmoxToken() {
  if (config.sshMode !== 'mock') {
    return process.env.PROXMOX_API_TOKEN || '';
  }

  if (process.env.PROXMOX_API_TOKEN) {
    return process.env.PROXMOX_API_TOKEN;
  }

  const token = await askForToken(config.DEFAULT_PROXMOX_TOKEN);
  process.env.PROXMOX_API_TOKEN = token;
  try {
    writeTokenToEnv(token);
    console.log(`Saved Proxmox API token to ${ENV_PATH}`);
  } catch (error) {
    console.warn('Unable to persist Proxmox token to .env:', error.message);
  }
  return token;
}

module.exports = {
  ensureProxmoxToken,
};
