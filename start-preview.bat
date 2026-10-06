@echo off
title Anime Card Battle - Preview Server
cls
echo ========================================
echo   ANIME CARD BATTLE - PREVIEW SERVER
echo ========================================
echo.
echo Starting HTTP server on port 8130...
echo.
echo To view the game:
echo   http://localhost:8130
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Try Node.js http-server first (most reliable)
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo Using Node.js http-server...
    start "" http://localhost:8130
    node -e "const http=require('http'); const fs=require('fs'); const path=require('path'); const server=http.createServer((req,res)=>{try{if(req.url==='/')req.url='/index.html'; const p=path.join(__dirname,req.url==='/index.html'?'.':req.url); const ext=p.split('.').pop().toLowerCase(); const mime={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml; charset=utf-8',mp4:'video/mp4',webm:'video/webm',ico:'image/x-icon',woff:'application/font-woff',woff2:'application/font-woff2',ttf:'application/font-ttf',eot:'application/vnd.ms-fontobject',txt:'text/plain'}; const ct=mime[ext]||'application/octet-stream'; fs.readFile(p,(err,d)=>{if(err){res.writeHead(404);res.end('Not found')}else{res.writeHead(200,{ 'Content-Type':ct });res.end(d)}})}catch(e){res.writeHead(500);res.end('Server error')}});server.listen(8130,'127.0.0.1',()=>console.log('Server running at http://127.0.0.1:8130'));"
) else (
    REM Try Python as fallback
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        echo Using Python HTTP server...
        start "" http://localhost:8130
        python -m http.server 8130 --bind 127.0.0.1
    ) else (
        REM If neither available, just open the file
        echo Neither Node.js nor Python found!
        echo Opening index.html directly in browser...
        start "" index.html
        echo.
        echo Note: For full functionality with assets, please install:
        echo   - Node.js: https://nodejs.org/ (recommended)
        echo   OR
        echo   - Python 3: https://www.python.org/downloads/
        echo Then run this batch file again.
    )
)
