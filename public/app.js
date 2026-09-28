const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const encodedWord = params.get('w');
const gameParam = params.get('g');
const randomMode = params.get('random') === '1';
let leaderboardPoll = null;

function setUrl(path) {
  history.pushState({}, '', path);
}

function stopLeaderboardPolling() {
  if (leaderboardPoll) clearInterval(leaderboardPoll);
  leaderboardPoll = null;
}

const RANDOM_WORDS = ['PLANT','CRANE','SMILE','LIGHT','STONE','BEACH','MUSIC','TRAIN','BRAVE','CLOUD'];
const keyRows = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','DELETE']
];

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function encodeWord(word) {
  const reversed = word.toUpperCase().split('').reverse().join('');
  return btoa(reversed).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function decodeWord(value) {
  try {
    const padded = value.replace(/-/g,'+').replace(/_/g,'/') + '==='.slice((value.length + 3) % 4);
    const reversed = atob(padded);
    const word = reversed.split('').reverse().join('').toUpperCase();
    return /^[A-Z]{2,15}$/.test(word) ? word : null;
  } catch { return null; }
}

function makeId(prefix = '') {
  let raw;
  if (window.crypto?.randomUUID) raw = crypto.randomUUID().replace(/-/g, '');
  else raw = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}${raw.slice(0, 16)}`;
}

function shell(inner, makeLink = false) {
  return `
    <header class="topbar">
      ${makeLink ? '<button class="top-link" data-action="home">Make your own wordle</button>' : ''}
      <h1 class="brand">Custom Wordle</h1>
    </header>
    ${inner}
  `;
}

function renderHome() {
  stopLeaderboardPolling();
  document.title = 'Custom Wordle';
  app.innerHTML = shell(`
    <section class="screen hero">
      <h2>Custom Wordle</h2>
      <p class="subtle">Guess the hidden word in 6 tries.<br>You can also share your own word.</p>
      <button class="primary" data-action="create">Make your own wordle</button>
      <div class="divider">OR</div>
      <button class="secondary" data-action="random">Play Random Word</button>
    </section>
  `);
}

function renderCreator() {
  stopLeaderboardPolling();
  document.title = 'Make Custom Wordle';
  app.innerHTML = shell(`
    <section class="screen creator">
      <h2>Make Custom Wordle</h2>
      <p class="subtle">Word can be of any length</p>
      <form id="createForm" autocomplete="off">
        <label for="wordInput">CUSTOM WORD</label>
        <input class="word-input" id="wordInput" maxlength="15" autofocus placeholder="Enter Custom Word" />
        <button class="primary" type="submit">Generate Link</button>
        <div class="error" id="creatorError"></div>
      </form>
      <div id="generated"></div>
    </section>
  `);

  const form = document.getElementById('createForm');
  const input = document.getElementById('wordInput');
  input.addEventListener('input', () => input.value = input.value.replace(/[^a-zA-Z]/g,'').toUpperCase());
  form.addEventListener('submit', e => {
    e.preventDefault();
    const word = input.value.trim().toUpperCase();
    const error = document.getElementById('creatorError');
    if (!/^[A-Z]{2,15}$/.test(word)) {
      error.textContent = 'Use 2–15 letters only.';
      return;
    }

    error.textContent = '';
    stopLeaderboardPolling();
    const gameId = makeId('g_');
    const url = `${location.origin}/?w=${encodeWord(word)}&g=${gameId}`;
    document.getElementById('generated').innerHTML = `
      <div class="link-card">
        <p>Your Wordle is ready.</p>
        <div class="link-row">
          <input id="shareUrl" readonly value="${escapeHtml(url)}" aria-label="Share link" />
          <button class="copy" id="copyLink" type="button">Copy</button>
        </div>
      </div>
      <div id="creatorLeaderboard"></div>
    `;

    renderCreatorLeaderboard(gameId);
    leaderboardPoll = setInterval(() => renderCreatorLeaderboard(gameId), 3000);

    const copy = document.getElementById('copyLink');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = 'Copied';
      } catch {
        const share = document.getElementById('shareUrl');
        share.select(); document.execCommand('copy'); copy.textContent = 'Copied';
      }
      setTimeout(() => copy.textContent = 'Copy', 1200);
    });
  });
}

async function fetchLeaderboard(gameId) {
  const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(gameId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Leaderboard request failed');
  const data = await res.json();
  return data.leaderboard || [];
}

function leaderboardRows(leaderboard, playerId = null) {
  if (!leaderboard.length) return '<p class="subtle leaderboard-empty">No scores yet.</p>';
  return leaderboard.map(entry => `
    <div class="score-row ${playerId && entry.playerId === playerId ? 'you' : ''}">
      <span class="rank">${entry.rank}</span>
      <span>${escapeHtml(entry.name)}${playerId && entry.playerId === playerId ? ' · you' : ''}</span>
      <span class="guesses">${entry.guesses} ${entry.guesses === 1 ? 'guess' : 'guesses'}</span>
    </div>
  `).join('');
}

async function renderCreatorLeaderboard(gameId) {
  const mount = document.getElementById('creatorLeaderboard');
  if (!mount) return;
  try {
    const leaderboard = await fetchLeaderboard(gameId);
    mount.innerHTML = `
      <div class="leaderboard creator-board">
        <div class="leaderboard-head">
          <h3>Leaderboard</h3>
          <small>updates live</small>
        </div>
        ${leaderboardRows(leaderboard)}
      </div>
    `;
  } catch {
    mount.innerHTML = '';
  }
}

async function getAlias() {
  const existing = localStorage.getItem('wordleAlias');
  if (existing) return existing;
  try {
    const res = await fetch('/api/alias');
    const data = await res.json();
    if (data.name) {
      localStorage.setItem('wordleAlias', data.name);
      return data.name;
    }
  } catch {}
  const fallback = `Player ${Math.floor(Math.random()*900+100)}`;
  localStorage.setItem('wordleAlias', fallback);
  return fallback;
}

function getPlayerId() {
  let id = localStorage.getItem('wordlePlayerId');
  if (!id) {
    id = makeId('p_');
    localStorage.setItem('wordlePlayerId', id);
  }
  return id;
}

function getFeedback(guess, target) {
  const result = Array(target.length).fill('absent');
  const remaining = {};

  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) result[i] = 'correct';
    else remaining[target[i]] = (remaining[target[i]] || 0) + 1;
  }
  for (let i = 0; i < target.length; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if ((remaining[ch] || 0) > 0) {
      result[i] = 'present';
      remaining[ch]--;
    }
  }
  return result;
}

function computeTileSize(length) {
  const gap = 5;
  const maxWidth = Math.min(window.innerWidth - 26, 350);
  return Math.max(28, Math.min(56, Math.floor((maxWidth - (length - 1) * gap) / length)));
}

async function renderGame(word, gameId) {
  stopLeaderboardPolling();
  const alias = await getAlias();
  const playerId = getPlayerId();
  document.title = 'Custom Wordle';
  const tileSize = computeTileSize(word.length);
  const rows = Array.from({ length: 6 }, (_, r) => `
    <div class="row" style="grid-template-columns:repeat(${word.length}, ${tileSize}px)">
      ${Array.from({ length: word.length }, (_, c) => `<div class="tile" style="--tile-size:${tileSize}px" data-r="${r}" data-c="${c}"></div>`).join('')}
    </div>
  `).join('');

  const keyboard = keyRows.map(row => `<div class="key-row">${row.map(key => `<button class="key ${key.length > 1 ? 'wide' : ''}" data-key="${key}">${key === 'DELETE' ? 'DEL' : key}</button>`).join('')}</div>`).join('');

  app.innerHTML = shell(`
    <section class="game-wrap">
      <p class="identity">Playing as <strong>${escapeHtml(alias)}</strong></p>
      <div class="board">${rows}</div>
      <div class="toast" id="toast"></div>
      <div class="keyboard">${keyboard}</div>
      <div id="resultMount"></div>
    </section>
  `, true);

  let row = 0;
  let current = '';
  let finished = false;
  const keyState = {};

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { if (el) el.textContent = ''; }, 1400);
  }

  function paintCurrent() {
    for (let c = 0; c < word.length; c++) {
      const tile = document.querySelector(`[data-r="${row}"][data-c="${c}"]`);
      if (!tile) continue;
      tile.textContent = current[c] || '';
      tile.classList.toggle('filled', Boolean(current[c]));
    }
  }

  function setKeyState(letter, state) {
    const weight = { absent: 1, present: 2, correct: 3 };
    if (!keyState[letter] || weight[state] > weight[keyState[letter]]) keyState[letter] = state;
    const key = document.querySelector(`[data-key="${letter}"]`);
    if (key) {
      key.classList.remove('absent','present','correct');
      key.classList.add(keyState[letter]);
    }
  }

  async function finish(win, guesses) {
    finished = true;
    document.querySelector('.keyboard').style.display = 'none';
    let leaderboard = [];
    if (win) {
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ game: gameId, name: alias, playerId, guesses })
        });
        leaderboard = (await res.json()).leaderboard || [];
      } catch {}
    } else {
      try { leaderboard = await fetchLeaderboard(gameId); }
      catch {}
    }
    renderResult(win, guesses, leaderboard);
  }

  function renderResult(win, guesses, leaderboard) {
    document.getElementById('resultMount').innerHTML = `
      <section class="result">
        <h2>${win ? `Solved in ${guesses}` : `The word was ${escapeHtml(word)}`}</h2>
        <p class="subtle">${win ? 'Your score was added automatically.' : 'No score added for an unsolved game.'}</p>
        <div class="leaderboard">
          <div class="leaderboard-head">
            <h3>Leaderboard</h3>
            <small>fewest guesses first</small>
          </div>
          ${leaderboardRows(leaderboard, playerId)}
        </div>
        <button class="play-again" data-action="create">Make another wordle</button>
      </section>
    `;
    document.getElementById('resultMount').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function submitGuess() {
    if (finished) return;
    if (current.length !== word.length) return toast('Not enough letters');
    const feedback = getFeedback(current, word);
    for (let c = 0; c < word.length; c++) {
      const tile = document.querySelector(`[data-r="${row}"][data-c="${c}"]`);
      tile.classList.remove('filled');
      tile.classList.add(feedback[c]);
      setKeyState(current[c], feedback[c]);
    }
    const won = current === word;
    const guesses = row + 1;
    if (won) return finish(true, guesses);
    if (row === 5) return finish(false, guesses);
    row++;
    current = '';
  }

  function onKey(key) {
    if (finished) return;
    if (key === 'ENTER') return submitGuess();
    if (key === 'DELETE' || key === 'BACKSPACE') {
      current = current.slice(0, -1);
      return paintCurrent();
    }
    if (/^[A-Z]$/.test(key) && current.length < word.length) {
      current += key;
      paintCurrent();
    }
  }

  app.querySelectorAll('[data-key]').forEach(btn => btn.addEventListener('click', () => onKey(btn.dataset.key)));
  document.addEventListener('keydown', function handler(e) {
    if (finished) { document.removeEventListener('keydown', handler); return; }
    const k = e.key.toUpperCase();
    if (k === 'ENTER' || k === 'BACKSPACE' || /^[A-Z]$/.test(k)) {
      e.preventDefault(); onKey(k);
    }
  });
}

app.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'create') { setUrl('/'); renderCreator(); }
  if (action === 'home') { setUrl('/'); renderCreator(); }
  if (action === 'random') {
    const word = RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
    const gameId = makeId('r_');
    setUrl(`/?w=${encodeWord(word)}&g=${gameId}&random=1`);
    renderGame(word, gameId);
  }
});

const initialWord = encodedWord ? decodeWord(encodedWord) : null;
const initialGameId = gameParam && /^[a-zA-Z0-9_-]{8,80}$/.test(gameParam)
  ? gameParam
  : (encodedWord ? `legacy_${encodedWord}` : null);

if (initialWord && initialGameId) renderGame(initialWord, initialGameId);
else if (randomMode) {
  const word = RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
  renderGame(word, makeId('r_'));
}
else renderHome();
