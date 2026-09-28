const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, '{}\n');

const ADJECTIVES = ['Bright','Calm','Clever','Cosmic','Happy','Jolly','Lucky','Mellow','Quick','Quiet','Sharp','Swift','Sunny','Witty'];
const ANIMALS = ['Badger','Bear','Fox','Koala','Otter','Owl','Panda','Robin','Seal','Tiger','Whale','Wolf'];

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function readScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
  catch { return {}; }
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2) + '\n');
}

function randomAlias() {
  const a = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const b = ANIMALS[crypto.randomInt(ANIMALS.length)];
  return `${a} ${b}`;
}

function validGameId(gameId) {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(gameId);
}

function getLeaderboard(gameId) {
  const scores = readScores();
  const stored = Array.isArray(scores[gameId]) ? scores[gameId] : [];
  return stored
    .slice()
    .sort((a, b) => a.guesses - b.guesses || a.at - b.at || a.name.localeCompare(b.name))
    .slice(0, 50)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      guesses: entry.guesses,
      playerId: entry.playerId
    }));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html':'text/html; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml; charset=utf-8',
    '.png':'imade/png',
    '.ico':'image/x-icon'
  })[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = rawPath === '/' ? '/index.html' : rawPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/alias' && req.method === 'GET') {
    json(res, 200, { name: randomAlias() });
    return;
  }

  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const gameId = String(url.searchParams.get('game') || '').trim();
    if (!validGameId(gameId)) return json(res, 400, { error: 'Invalid game' });
    return json(res, 200, { leaderboard: getLeaderboard(gameId) });
  }

  if (url.pathname === '/api/score' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const gameId = String(body.game || '').trim();
      const name = String(body.name || '').trim().slice(0, 40);
      const playerId = String(body.playerId || '').trim().slice(0, 80);
      const guesses = Number(body.guesses);

      if (!validGameId(gameId) || !name || !/^[a-zA-Z0-9_-]{8,80}$/.test(playerId) || !Number.isInteger(guesses) || guesses < 1 || guesses > 6) {
        return json(res, 400, { error: 'Invalid score' });
      }

      const scores = readScores();
      scores[gameId] = Array.isArray(scores[gameId]) ? scores[gameId] : [];

      const existingIndex = scores[gameId].findIndex(entry => entry.playerId === playerId);
      const existing = existingIndex >= 0 ? scores[gameId][existingIndex] : null;
      const entry = {
        name,
        playerId,
        guesses: existing ? Math.min(existing.guesses, guesses) : guesses,
        at: existing ? existing.at : Date.now()
      };

      if (existingIndex >= 0) scores[gameId][existingIndex] = entry;
      else scores[gameId].push(entry);

      scores[gameId] = scores[gameId]
        .sort((a,b) => a.guesses - b.guesses || a.at - b.at)
        .slice(0, 100);

      writeScores(scores);
      return json(res, 201, { leaderboard: getLeaderboard(gameId) });
    } catch {
      return json(res, 400, { error: 'Bad request' });
    }
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Minimal Wordle running at http://localhost:${PORT}`);
});
