let UndiciAgent;
try {
  ({ Agent: UndiciAgent } = require('undici'));
} catch (error) {
  UndiciAgent = null;
}
const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('../config');

const execFileAsync = promisify(execFile);

function getDispatcher() {
  if (!config.proxmoxInsecure || !UndiciAgent) {
    return undefined;
  }
  return new UndiciAgent({
    connect: {
      rejectUnauthorized: false,
    },
  });
}

function buildHeaders() {
  if (!config.proxmoxToken) {
    throw new Error('Missing Proxmox API token. Set PROXMOX_API_TOKEN in .env');
  }
  return {
    Authorization: `PVEAPIToken=${config.proxmoxToken}`,
    Accept: 'application/json',
  };
}

function normalizeBaseUrl() {
  const raw = config.proxmoxApiUrl.replace(/\/$/, '');
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    return raw;
  }
}

async function apiGet(pathname) {
  const res = await fetch(`${normalizeBaseUrl()}${pathname}`, {
    headers: buildHeaders(),
    dispatcher: getDispatcher(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxmox API error ${res.status}: ${text}`);
  }

  const payload = await res.json();
  return payload.data ?? payload;
}

function extractIpFromValue(value) {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/\bip=([^,\s]+)/);
  if (!match) return '';
  const ipValue = match[1].replace(/\/.*/, '');
  if (!ipValue || ipValue.toLowerCase() === 'dhcp') return '';
  return ipValue;
}

function extractIpFromConfig(configData = {}) {
  const keys = Object.keys(configData);
  for (const key of keys) {
    if (key.startsWith('net') || key.startsWith('ipconfig')) {
      const ip = extractIpFromValue(configData[key]);
      if (ip) return ip;
    }
  }
  return '';
}

async function fetchVmConfig(node, type, vmid) {
  try {
    return await apiGet(`/nodes/${encodeURIComponent(node)}/${type}/${vmid}/config`);
  } catch (error) {
    return {};
  }
}

function mapTarget({ node, type, vmid, name, status, os, cpu, maxcpu, mem, maxmem, uptime }, ip) {
  return {
    id: `${node}-${vmid}`,
    vmid: String(vmid),
    node,
    type,
    name: name || `${type}-${vmid}`,
    ip: ip || '',
    host: ip || name || `${type}-${vmid}`,
    status: status || 'unknown',
    os: os || '',
    username: config.sshUser,
    cpu,
    maxcpu,
    mem,
    maxmem,
    uptime,
  };
}

async function fetchNodeTargets(node) {
  const [lxcs, vms] = await Promise.all([
    apiGet(`/nodes/${encodeURIComponent(node)}/lxc`),
    apiGet(`/nodes/${encodeURIComponent(node)}/qemu`),
  ]);

  const lxcTargets = await Promise.all(
    (lxcs || []).map(async (lxc) => {
      const configData = await fetchVmConfig(node, 'lxc', lxc.vmid);
      const ip = extractIpFromConfig(configData);
      return mapTarget({ ...lxc, node, type: 'ct' }, ip);
    })
  );

  const vmTargets = await Promise.all(
    (vms || []).map(async (vm) => {
      const configData = await fetchVmConfig(node, 'qemu', vm.vmid);
      const ip = extractIpFromConfig(configData);
      return mapTarget({ ...vm, node, type: 'vm' }, ip);
    })
  );

  return [...lxcTargets, ...vmTargets];
}

async function fetchTargets() {
  try {
    const nodes = config.proxmoxNode
      ? [config.proxmoxNode]
      : (await apiGet('/nodes')).map((node) => node.node);

    const results = await Promise.all(nodes.map((node) => fetchNodeTargets(node)));
    return results.flat();
  } catch (error) {
    return fetchTargetsViaCli(error);
  }
}

async function fetchTargetsViaCli(error) {
  console.warn('Proxmox API unavailable, falling back to CLI discovery:', error.message);

  const [lxcRows, vmRows] = await Promise.all([listPctTargets(), listQmTargets()]);
  const lxcTargets = await Promise.all(
    lxcRows.map(async (row) => {
      const configData = await readPctConfig(row.vmid);
      const ip = extractIpFromConfig(configData);
      return mapTarget({
        node: config.proxmoxNode || 'local',
        type: 'ct',
        vmid: row.vmid,
        name: row.name,
        status: row.status,
      }, ip);
    })
  );

  const vmTargets = await Promise.all(
    vmRows.map(async (row) => {
      const configData = await readQmConfig(row.vmid);
      const ip = extractIpFromConfig(configData);
      return mapTarget({
        node: config.proxmoxNode || 'local',
        type: 'vm',
        vmid: row.vmid,
        name: row.name,
        status: row.status,
      }, ip);
    })
  );

  return [...lxcTargets, ...vmTargets];
}

async function listPctTargets() {
  try {
    const { stdout } = await execFileAsync('pct', ['list']);
    return parseTable(stdout);
  } catch (error) {
    console.warn('pct list failed:', error.message);
    return [];
  }
}

async function listQmTargets() {
  try {
    const { stdout } = await execFileAsync('qm', ['list']);
    return parseTable(stdout);
  } catch (error) {
    console.warn('qm list failed:', error.message);
    return [];
  }
}

async function readPctConfig(vmid) {
  try {
    const { stdout } = await execFileAsync('pct', ['config', String(vmid)]);
    return parseKeyValue(stdout);
  } catch (error) {
    return {};
  }
}

async function readQmConfig(vmid) {
  try {
    const { stdout } = await execFileAsync('qm', ['config', String(vmid)]);
    return parseKeyValue(stdout);
  } catch (error) {
    return {};
  }
}

function parseTable(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/\s+/).map((header) => header.toLowerCase());
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s+/);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = parts[index];
    });
    return {
      vmid: row.vmid || parts[0],
      name: row.name || parts[1],
      status: row.status || parts[2],
    };
  });
}

function parseKeyValue(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const result = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

module.exports = {
  fetchTargets,
};
