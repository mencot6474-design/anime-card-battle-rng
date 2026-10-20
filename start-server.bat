@echo off
title Anime Card Battle - Dev Server
cls

echo ========================================
echo   ANIME CARD BATTLE - DEV SERVER
echo ========================================
echo.
echo Starting on http://localhost:8080...
echo.
echo This bypasses ALL browser cache issues!
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Create a temporary Node.js script for static server
echo Creating server... > temp.txt
node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const handler = (req, res) => {
  let url = req.url === '/' ? '/index_fresh.html' : req.url;
  
  // Remove query params for file lookup
  url = url.split('?')[0];
  
  const filePath = path.join(ROOT, url);
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ico': 'image/x-icon'
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  // DISABLE CACHE - NO EXCEPTIONS
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try serving index.html as fallback (SPA routing)
        const indexPath = path.join(ROOT, 'index_fresh.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('File not found: ' + url);
          } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(data2);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(data);
    }
  });
  
  console.log(req.method, url);
};

const server = http.createServer(handler);

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('========================================');
  console.log('✓ Server running at http://localhost:' + PORT);
  console.log('');
  console.log('OPEN THIS URL IN BROWSER:');
  console.log('http://localhost:' + PORT + '/index_fresh.html');
  console.log('========================================');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});
"
pause
