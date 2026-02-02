const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_PORT = 3105;
const SERVER_HOST = '127.0.0.1';

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for server to start'));
    }, 10000);

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Ready to accept connections!')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Failed to start server')) {
        clearTimeout(timeout);
        reject(new Error(text.trim()));
      }
    });
  });
}

function request({ method, path: reqPath, body, headers = {} }) {
  const options = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: reqPath,
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

(async () => {
  const serverPath = path.join(__dirname, '../src/server.js');
  const env = {
    ...process.env,
    PROXMOX_API_TOKEN: 'dummy',
    WEB_AUTH_ENABLED: '1',
    WEB_AUTH_USER: 'admin',
    WEB_AUTH_PASS: 'pass',
    PORT: String(SERVER_PORT),
    HOST: SERVER_HOST,
  };

  const proc = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    await waitForServer(proc);

    const loginPayload = JSON.stringify({ username: 'admin', password: 'pass' });
    const loginRes = await request({
      method: 'POST',
      path: '/login',
      body: loginPayload,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginPayload),
      },
    });

    const setCookie = loginRes.headers['set-cookie'];
    if (!setCookie || !setCookie.length) {
      throw new Error('Login did not return Set-Cookie');
    }

    const cookieHeader = setCookie.map((entry) => entry.split(';')[0]).join('; ');

    const homeRes = await request({
      method: 'GET',
      path: '/',
      headers: {
        Cookie: cookieHeader,
      },
    });

    const looksLikeLogin = homeRes.body.includes('Sign in to access your terminal workspace');
    const looksLikeIndex = homeRes.body.includes('Web SSH Bastion') && homeRes.body.includes('target-list');

    console.log('Login status:', loginRes.status);
    console.log('Home status:', homeRes.status);
    console.log('Home looks like login page:', looksLikeLogin);
    console.log('Home looks like index page:', looksLikeIndex);

    if (looksLikeLogin) {
      throw new Error('Authentication loop: login page still served after valid cookie.');
    }
  } catch (error) {
    console.error('AUTH TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    proc.kill('SIGINT');
  }
})();
