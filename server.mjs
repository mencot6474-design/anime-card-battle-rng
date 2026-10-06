import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8130;

const server = http.createServer((req, res) => {
  console.log(`📡 Request: ${req.method} ${req.url}`);
  
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
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
    '.ico': 'image/x-icon'
  };
  
  const contentType = contentTypes[extname] || 'text/plain';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try serving index.html for SPA routing
        fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2, 'utf8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': extname === '.html' ? 'no-cache' : 'max-age=31536000'
      });
      res.end(content, 'utf8');
    }
  });
});

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  🎮 ANIME CARD BATTLE - GAME SERVER       ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`📍 Server running at: http://localhost:${PORT}/`);
  console.log(`📁 Root directory: ${__dirname}`);
  console.log(`💻 Open your browser to test the game!\n`);
});

// Keep server running
process.stdin.on('data', async () => {});
