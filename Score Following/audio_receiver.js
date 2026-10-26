const http = require('http');
const fs = require('fs');
const path = require('path');

const targetDir = "C:\\Users\\fttub\\.gemini\\antigravity-ide\\brain\\eac88363-c84d-48cc-83fe-65920eae9184";

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-filename, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    const filename = req.headers['x-filename'] || `recording_${Date.now()}.webm`;
    const filePath = path.join(targetDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    
    req.pipe(writeStream);
    
    writeStream.on('finish', () => {
      console.log(`[Receiver] Saved audio file to ${filePath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: filePath }));
    });

    writeStream.on('error', (err) => {
      console.error('[Receiver] Write error:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('[Receiver] Audio receiver running on http://localhost:3000');
});
