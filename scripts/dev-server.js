const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest, sendJson } = require('../api/_lib/api-handler');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFilePath(requestUrl) {
  const cleanUrl = requestUrl.split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(cleanUrl);
  } catch {
    return null;
  }

  // Block direct HTTP access to private data & server internals
  if (
    decoded === '/data' ||
    decoded.startsWith('/data/') ||
    decoded === '/scripts' ||
    decoded.startsWith('/scripts/') ||
    decoded === '/api' ||
    decoded.startsWith('/api/')
  ) {
    return null;
  }

  let relativePath = decoded === '/' ? '/index.html' : decoded;
  if (relativePath === '/favicon.ico' && !fs.existsSync(path.join(ROOT_DIR, 'favicon.ico'))) {
    relativePath = '/images/favicon.png';
  }
  if (relativePath === '/admin') relativePath = '/admin.html';
  if (relativePath === '/consulta') relativePath = '/página de consulta/index.html';

  const fullPath = path.resolve(ROOT_DIR, '.' + relativePath);
  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return fullPath;
}

const server = http.createServer((req, res) => {
  const cleanPath = (req.url || '/').split('?')[0];

  if (cleanPath.startsWith('/api/')) {
    handleApiRequest(req, res).catch((err) => {
      console.error('[API ERROR]', err);
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: 'Erro interno no servidor.' });
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolveFilePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!err && stats.isDirectory()) {
        const cleanUrl = (req.url || '/').split('?')[0];
        if (!cleanUrl.endsWith('/')) {
          const query = (req.url || '').includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '';
          res.writeHead(301, { Location: cleanUrl + '/' + query });
          res.end();
          return;
        }
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          serveFile(indexPath, fs.statSync(indexPath), req, res);
          return;
        }
      }
      console.log(`[404] ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    serveFile(filePath, stats, req, res);
  });
});

function serveFile(filePath, stats, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const totalSize = stats.size;
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (isNaN(start) || isNaN(end) || start > end || end >= totalSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': totalSize,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function startServer(port) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE') {
      server.removeListener('listening', onListening);
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  };
  const onListening = () => {
    server.removeListener('error', onError);
    console.log(`Local server running at http://localhost:${port}/`);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

startServer(DEFAULT_PORT);
