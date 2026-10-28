import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8130;

const candidateFiles = [
  'index.html',
  'js/tower-lobby.js',
  'js/boot.js',
  'js/panels.js',
  'js/state.js',
  'js/battle.js',
  'js/gacha.js',
  'js/raid.js',
  'js/ranking.js',
  'css/lobby-prototype.css',
  'css/style.css'
];

function locateElement(query) {
  const { id, className, text } = query;
  let matches = [];

  for (const relPath of candidateFiles) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let score = 0;

      if (id) {
        if (line.includes(`id="${id}"`) || line.includes(`id='${id}'`) || line.includes(`id=\\\"${id}\\\"`)) {
          score += 100;
        } else if (line.includes(`"${id}"`) || line.includes(`'${id}'`)) {
          score += 40;
        } else if (line.includes(id)) {
          score += 15;
        }
      }

      if (className) {
        const classes = String(className).split(' ').filter(c => c.trim().length > 2);
        for (const c of classes) {
          if (line.includes(`class="${c}"`) || line.includes(`.${c}`)) {
            score += 20;
          } else if (line.includes(c)) {
            score += 5;
          }
        }
      }

      if (score > 0) {
        if (relPath.endsWith('.html') || relPath.endsWith('.js')) {
          score += 10;
        }
        matches.push({ relPath, fullPath, line: i + 1, text: line.trim(), score });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches[0] || null;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const cleanUrl = parsedUrl.pathname;

  // 1. API: Locate Code Endpoint
  if (cleanUrl === '/api/locate-code') {
    const id = parsedUrl.searchParams.get('id') || '';
    const className = parsedUrl.searchParams.get('className') || '';
    const tag = parsedUrl.searchParams.get('tag') || '';
    const text = parsedUrl.searchParams.get('text') || '';

    const match = locateElement({ id, className, tag, text });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });

    if (match) {
      res.end(JSON.stringify({
        success: true,
        file: match.relPath.replace(/\\/g, '/'),
        fullPath: match.fullPath.replace(/\\/g, '/'),
        line: match.line,
        text: match.text
      }));
    } else {
      res.end(JSON.stringify({ success: false, message: 'Source line not found' }));
    }
    return;
  }

  // 2. API: Open in Editor Endpoint
  if (cleanUrl === '/api/open-in-editor') {
    const file = parsedUrl.searchParams.get('file') || '';
    const line = parsedUrl.searchParams.get('line') || '1';

    if (file) {
      const absPath = path.isAbsolute(file) ? file : path.resolve(__dirname, file);
      const normalizedPath = absPath.replace(/\\/g, '/');

      console.log(`🚀 Jumping editor cursor to: ${normalizedPath}:${line}`);

      // 1. Antigravity protocol
      exec(`start "" "antigravity://file/${normalizedPath}:${line}"`, () => {});
      // 2. Cursor CLI
      exec(`cursor -g "${absPath}:${line}"`, () => {});
      // 3. VS Code CLI
      exec(`code -g "${absPath}:${line}"`, () => {});

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, opened: normalizedPath, line: Number(line) }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'File parameter required' }));
    }
    return;
  }

  // Normalize any asset requests that prepended /css/ or /js/
  let assetUrl = cleanUrl;
  if (assetUrl.startsWith('/css/assets/')) {
    assetUrl = assetUrl.replace('/css/assets/', '/assets/');
  } else if (assetUrl.startsWith('/js/assets/')) {
    assetUrl = assetUrl.replace('/js/assets/', '/assets/');
  }

  let filePath = path.join(__dirname, assetUrl === '/' ? 'index.html' : assetUrl);

  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon'
  };

  const contentType = contentTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const ext = path.extname(assetUrl);
        if (ext && ext !== '.html') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Asset not found');
          return;
        }
        // Try serving index.html for SPA routing only for html/extensionless routes
        fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept-Ranges': 'bytes'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  🎮 ANIME CARD BATTLE - GAME SERVER       ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`📍 Server running at: http://localhost:${PORT}/`);
  console.log(`📁 Root directory: ${__dirname}`);
  console.log(`🎯 Code Inspector API active on /api/locate-code & /api/open-in-editor`);
  console.log(`💻 Open your browser to test the game!\n`);
});

// Keep server running
process.stdin.on('data', async () => {});
