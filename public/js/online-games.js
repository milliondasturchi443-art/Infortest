// ═══════ ONLINE MULTIPLAYER GAMES ═══════
var socket = null;
var onlineState = { inQueue: false, inGame: false, inLobby: false, lobbyCode: null, roomId: null, gameType: null, mode: null, myId: null, mapId: 'default' };
var onlineKeys = {};
var onlineTouchAngle = null;
var onlineTouchShoot = false;
var onlineJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
var onlineAimJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
var onlineMyPos = { x: 400, y: 300 };
var onlineInputInterval = null;

var GAME_MAPS = {
  shooter: [
    { id: 'default', name: 'Oddiy', icon: '🏙️', desc: '8 ta devor' },
    { id: 'city', name: 'Shahar', icon: '🌆', desc: 'Ko\'p devorlar' },
    { id: 'desert', name: 'Cho\'l', icon: '🏜️', desc: 'Kam pana joy' },
    { id: 'maze', name: 'Labirint', icon: '🏗️', desc: 'Juda ko\'p devor' }
  ],
  tanks: [
    { id: 'default', name: 'Oddiy', icon: '🏙️', desc: '10 ta devor' },
    { id: 'fortress', name: 'Qal\'a', icon: '🏰', desc: 'Ko\'p pana joy' },
    { id: 'open', name: 'Ochiq maydon', icon: '🌾', desc: 'Kam pana' },
    { id: 'ruins', name: 'Xarobalar', icon: '🏚️', desc: 'Juda ko\'p devor' }
  ],
  arena: [
    { id: 'default', name: 'Oddiy', icon: '⚔️', desc: 'Klassik arena' },
    { id: 'colosseum', name: 'Kolizey', icon: '🏛️', desc: 'Rim arenaси' },
    { id: 'ice', name: 'Muz', icon: '❄️', desc: 'Muzlik arena' }
  ]
};

function getSocket() {
  if (!socket || !socket.connected) {
    socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    setupSocketEvents();
  }
  return socket;
}

function setupSocketEvents() {
  socket.on('queue_update', function (data) {
    var el = document.getElementById('queueCount');
    if (el) el.textContent = data.count;
  });

  socket.on('match_found', function (data) {
    onlineState.roomId = data.roomId;
    onlineState.gameType = data.gameType;
    onlineState.mode = data.mode;
    onlineState.inQueue = false;
    onlineState.inLobby = false;
    onlineState.inGame = true;
    startOnlineGame(data);
  });

  socket.on('game_state', function (data) {
    renderOnlineGame(data);
  });

  socket.on('game_over', function (data) {
    onlineState.inGame = false;
    showOnlineResult(data);
  });

  socket.on('player_disconnected', function (data) {
    var hud = document.getElementById('onlineHUD');
    if (hud) hud.innerHTML += '<span style="color:#ef4444;margin-left:12px">O\'yinchi chiqib ketdi!</span>';
  });

  // lobby events
  socket.on('lobby_created', function (data) {
    onlineState.inLobby = true;
    onlineState.lobbyCode = data.code;
    renderLobbyView(data.lobby);
  });

  socket.on('lobby_update', function (data) {
    renderLobbyView(data.lobby);
  });

  socket.on('lobby_error', function (data) {
    alert(data.error);
  });
}

// ═══ MAP PICKER ═══
function showGameConfig(gameType, mode) {
  if (!currentUser) { alert('Avval tizimga kiring!'); return; }
  onlineState.myId = currentUser.id;
  onlineState.gameType = gameType;
  onlineState.mode = mode;
  onlineState.mapId = 'default';

  document.getElementById('onlineLobby').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';

  var maps = GAME_MAPS[gameType] || [];
  var html = '<div style="max-width:500px;margin:0 auto;padding:20px">';
  html += '<h2 style="text-align:center;font-size:1.2rem;margin-bottom:6px">' + getGameTitle(gameType) + ' — ' + mode.toUpperCase() + '</h2>';
  html += '<p style="text-align:center;color:var(--muted);font-size:.85rem;margin-bottom:16px">Xarita va usulni tanlang</p>';

  // map selection
  html += '<div style="margin-bottom:16px"><label style="font-weight:700;font-size:.85rem;display:block;margin-bottom:8px">🗺️ Xarita tanlang:</label>';
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px" id="mapGrid">';
  maps.forEach(function (m) {
    html += '<div class="map-option' + (m.id === 'default' ? ' map-selected' : '') + '" data-map="' + m.id + '" onclick="selectMap(\'' + m.id + '\')" style="padding:12px;border:2px solid var(--border);border-radius:10px;text-align:center;cursor:pointer;transition:all .2s">';
    html += '<div style="font-size:1.5rem">' + m.icon + '</div>';
    html += '<div style="font-weight:700;font-size:.85rem">' + m.name + '</div>';
    html += '<div style="font-size:.7rem;color:var(--muted)">' + m.desc + '</div></div>';
  });
  html += '</div></div>';

  // action buttons
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">';
  html += '<button class="btn btn-sm btn-primary" onclick="startMatchmaking()">🔍 Raqib qidirish</button>';
  html += '<button class="btn btn-sm btn-green" onclick="createLobby()">🏠 Lobby yaratish</button>';
  html += '<button class="btn btn-sm btn-outline" onclick="showJoinLobby()">🔑 Kodga qo\'shilish</button>';
  html += '</div>';
  html += '<div style="margin-top:12px;text-align:center"><button class="btn btn-sm btn-outline" onclick="backToOnlineLobby()">← Orqaga</button></div>';
  html += '</div>';
  mm.innerHTML = html;
}

function selectMap(mapId) {
  onlineState.mapId = mapId;
  var options = document.querySelectorAll('.map-option');
  options.forEach(function (o) { o.classList.remove('map-selected'); });
  var sel = document.querySelector('[data-map="' + mapId + '"]');
  if (sel) sel.classList.add('map-selected');
}

// ═══ MATCHMAKING ═══
function openOnlineGame(gameType, mode) {
  showGameConfig(gameType, mode);
}

function startMatchmaking() {
  var s = getSocket();
  var mm = document.getElementById('onlineMatchmaking');
  mm.innerHTML =
    '<div class="game-area" style="text-align:center;padding:40px 20px">' +
    '<div class="matchmaking-spinner"></div>' +
    '<h2 style="font-size:1.3rem;margin:20px 0 8px">' + getGameTitle(onlineState.gameType) + ' — ' + onlineState.mode.toUpperCase() + '</h2>' +
    '<p style="color:var(--muted);margin-bottom:12px">Raqib qidirilmoqda...</p>' +
    '<p style="font-size:1.5rem;font-weight:900;color:var(--primary)" id="queueCount">1</p>' +
    '<p style="color:var(--muted);font-size:.8rem;margin-bottom:20px">o\'yinchi navbatda</p>' +
    '<p style="color:var(--muted);font-size:.75rem;margin-bottom:20px">Boshqa brauzer oynasida ham kiring!</p>' +
    '<button class="btn btn-sm btn-outline" onclick="leaveOnlineQueue()">Bekor qilish</button></div>';

  onlineState.inQueue = true;
  s.emit('join_queue', {
    gameType: onlineState.gameType,
    mode: onlineState.mode,
    mapId: onlineState.mapId,
    player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade }
  });
}

// ═══ LOBBY ═══
function createLobby() {
  var s = getSocket();
  s.emit('create_lobby', {
    gameType: onlineState.gameType,
    mode: onlineState.mode,
    mapId: onlineState.mapId,
    player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade }
  });
}

function showJoinLobby() {
  var mm = document.getElementById('onlineMatchmaking');
  mm.innerHTML =
    '<div style="max-width:400px;margin:0 auto;padding:30px 20px;text-align:center">' +
    '<h2 style="font-size:1.2rem;margin-bottom:16px">🔑 Lobby kodini kiriting</h2>' +
    '<input type="text" id="joinCodeInput" placeholder="Masalan: RF9CA" maxlength="5" style="font-size:1.8rem;text-align:center;letter-spacing:6px;font-weight:900;text-transform:uppercase;width:200px;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--card);color:var(--text)">' +
    '<div style="margin-top:16px;display:flex;gap:10px;justify-content:center">' +
    '<button class="btn btn-sm btn-primary" onclick="joinLobbyByCode()">Kirish</button>' +
    '<button class="btn btn-sm btn-outline" onclick="showGameConfig(onlineState.gameType,onlineState.mode)">← Orqaga</button>' +
    '</div></div>';
  setTimeout(function () { var inp = document.getElementById('joinCodeInput'); if (inp) inp.focus(); }, 100);
}

function joinLobbyByCode() {
  var code = (document.getElementById('joinCodeInput').value || '').trim().toUpperCase();
  if (code.length < 3) { alert('Kodni kiriting!'); return; }
  var s = getSocket();
  s.emit('join_lobby', { code: code, player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade } });
}

function renderLobbyView(lobby) {
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';
  document.getElementById('onlineLobby').style.display = 'none';

  var isHost = lobby.host === currentUser.id;
  var maps = GAME_MAPS[lobby.gameType] || [];
  var curMap = maps.find(function (m) { return m.id === lobby.mapId; }) || maps[0];

  var html = '<div style="max-width:500px;margin:0 auto;padding:20px">';
  html += '<div style="text-align:center;margin-bottom:16px">';
  html += '<h2 style="font-size:1.1rem;margin-bottom:4px">' + getGameTitle(lobby.gameType) + ' — ' + lobby.mode.toUpperCase() + '</h2>';
  html += '<div style="background:var(--card);border:2px dashed var(--primary);border-radius:12px;padding:16px;margin:12px auto;max-width:280px">';
  html += '<div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Lobby kodi:</div>';
  html += '<div style="font-size:2rem;font-weight:900;letter-spacing:6px;color:var(--primary)" id="lobbyCodeDisplay">' + lobby.code + '</div>';
  html += '<button class="btn btn-sm btn-outline" style="margin-top:8px;font-size:.7rem" onclick="copyLobbyCode(\'' + lobby.code + '\')">📋 Nusxalash</button>';
  html += '</div></div>';

  // players
  html += '<div style="margin-bottom:16px"><div style="font-weight:700;font-size:.85rem;margin-bottom:8px">O\'yinchilar (' + lobby.players.length + '/' + lobby.needed + '):</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  lobby.players.forEach(function (p, i) {
    var isMe = p.id === currentUser.id;
    html += '<div style="padding:10px 16px;border-radius:10px;background:' + (isMe ? 'var(--primary)' : 'var(--card)') + ';color:' + (isMe ? '#fff' : 'var(--text)') + ';font-weight:700;font-size:.85rem;border:2px solid ' + (p.id === lobby.host ? 'var(--primary)' : 'var(--border)') + '">';
    html += (p.id === lobby.host ? '👑 ' : '') + p.name + (p.grade ? ' (' + p.grade + ')' : '') + '</div>';
  });
  for (var i = lobby.players.length; i < lobby.needed; i++) {
    html += '<div style="padding:10px 16px;border-radius:10px;background:var(--bg);color:var(--muted);font-size:.85rem;border:2px dashed var(--border)">Kutilmoqda...</div>';
  }
  html += '</div></div>';

  // map (host can change)
  html += '<div style="margin-bottom:16px"><div style="font-weight:700;font-size:.85rem;margin-bottom:6px">🗺️ Xarita: ' + (curMap ? curMap.icon + ' ' + curMap.name : lobby.mapId) + '</div>';
  if (isHost) {
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
    maps.forEach(function (m) {
      html += '<div class="map-option' + (m.id === lobby.mapId ? ' map-selected' : '') + '" onclick="changeLobbyMap(\'' + lobby.code + '\',\'' + m.id + '\')" style="padding:8px;border:2px solid var(--border);border-radius:8px;text-align:center;cursor:pointer;font-size:.8rem">';
      html += m.icon + ' ' + m.name + '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  html += '<div style="text-align:center"><button class="btn btn-sm btn-outline" onclick="leaveLobby(\'' + lobby.code + '\')">Chiqish</button></div>';
  html += '</div>';
  mm.innerHTML = html;
}

function copyLobbyCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
    var el = document.getElementById('lobbyCodeDisplay');
    if (el) { el.textContent = 'Nusxalandi!'; setTimeout(function () { el.textContent = code; }, 1500); }
  }
}

function changeLobbyMap(code, mapId) {
  var s = getSocket();
  s.emit('lobby_change_map', { code: code, mapId: mapId, playerId: currentUser.id });
}

function leaveLobby(code) {
  if (socket) socket.emit('leave_lobby', { code: code, playerId: currentUser.id });
  onlineState.inLobby = false;
  onlineState.lobbyCode = null;
  backToOnlineLobby();
}

// ═══ FRIENDS ═══
function showFriendsPanel() {
  var panel = document.getElementById('friendsPanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  loadFriends();
}

function loadFriends() {
  if (!currentUser) return;
  fetch('/api/auth/friends/' + currentUser.id)
    .then(function (r) { return r.json(); })
    .then(function (friends) {
      var html = '<div style="margin-bottom:12px">';
      html += '<div style="font-weight:700;font-size:.9rem;margin-bottom:8px">Sizning kodingiz:</div>';
      html += '<div style="font-size:1.3rem;font-weight:900;letter-spacing:4px;color:var(--primary);background:var(--bg);padding:8px 16px;border-radius:8px;display:inline-block">' + (currentUser.friendCode || '...') + '</div>';
      html += '</div>';
      html += '<div style="margin-bottom:12px"><div style="display:flex;gap:6px">';
      html += '<input type="text" id="addFriendCode" placeholder="Kod kiriting" maxlength="5" style="flex:1;padding:8px;border:2px solid var(--border);border-radius:8px;font-size:.85rem;text-transform:uppercase;background:var(--card);color:var(--text)">';
      html += '<button class="btn btn-sm btn-primary" onclick="addFriend()">Qo\'shish</button></div>';
      html += '<div id="addFriendMsg" style="font-size:.75rem;margin-top:4px"></div></div>';

      if (friends.length > 0) {
        html += '<div style="font-weight:700;font-size:.85rem;margin-bottom:6px">Do\'stlar (' + friends.length + '):</div>';
        friends.forEach(function (f) {
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:var(--bg);margin-bottom:4px">';
          html += '<div><span style="font-weight:700">' + f.name + '</span> <span style="font-size:.75rem;color:var(--muted)">' + (f.grade || '') + ' | ' + (f.gamePoints || 0) + ' ochko</span></div>';
          html += '<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:.65rem" onclick="removeFriend(\'' + f.id + '\')">✕</button></div>';
        });
      } else {
        html += '<p style="color:var(--muted);font-size:.8rem;text-align:center">Hali do\'stlar yo\'q</p>';
      }
      document.getElementById('friendsList').innerHTML = html;
    })
    .catch(function () {
      document.getElementById('friendsList').innerHTML = '<p style="color:var(--muted)">Yuklanmadi</p>';
    });
}

function addFriend() {
  var code = (document.getElementById('addFriendCode').value || '').trim().toUpperCase();
  if (!code) return;
  fetch('/api/auth/friend/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, friendCode: code })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var msg = document.getElementById('addFriendMsg');
      if (data.error) { msg.innerHTML = '<span style="color:#ef4444">' + data.error + '</span>'; }
      else { msg.innerHTML = '<span style="color:#22c55e">' + data.friend.name + ' qo\'shildi!</span>'; document.getElementById('addFriendCode').value = ''; loadFriends(); }
    })
    .catch(function () { });
}

function removeFriend(friendId) {
  fetch('/api/auth/friend/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, friendId: friendId })
  }).then(function () { loadFriends(); });
}

function showJoinLobbyDirect() {
  if (!currentUser) { alert('Avval tizimga kiring!'); return; }
  onlineState.myId = currentUser.id;
  document.getElementById('onlineLobby').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';
  mm.innerHTML =
    '<div style="max-width:400px;margin:0 auto;padding:30px 20px;text-align:center">' +
    '<h2 style="font-size:1.2rem;margin-bottom:16px">🔑 Lobby kodini kiriting</h2>' +
    '<input type="text" id="joinCodeInput" placeholder="Masalan: RF9CA" maxlength="5" style="font-size:1.8rem;text-align:center;letter-spacing:6px;font-weight:900;text-transform:uppercase;width:200px;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--card);color:var(--text)">' +
    '<div style="margin-top:16px;display:flex;gap:10px;justify-content:center">' +
    '<button class="btn btn-sm btn-primary" onclick="joinLobbyByCode()">Kirish</button>' +
    '<button class="btn btn-sm btn-outline" onclick="backToOnlineLobby()">← Orqaga</button>' +
    '</div></div>';
  var s = getSocket();
  setTimeout(function () { var inp = document.getElementById('joinCodeInput'); if (inp) inp.focus(); }, 100);
}

// ═══ COMMON ═══
function getGameTitle(type) {
  if (type === 'shooter') return '🔫 2D Shooter';
  if (type === 'tanks') return '🔵 2D Tanklar';
  if (type === 'arena') return '⚔️ 2D Arena';
  return type;
}

function leaveOnlineQueue() {
  if (socket && onlineState.inQueue) {
    socket.emit('leave_queue', { gameType: onlineState.gameType, mode: onlineState.mode, playerId: currentUser.id });
  }
  onlineState.inQueue = false;
  backToOnlineLobby();
}

function backToOnlineLobby() {
  onlineState.inGame = false;
  onlineState.inQueue = false;
  onlineState.inLobby = false;
  onlineState.roomId = null;
  onlineState.lobbyCode = null;
  if (onlineInputInterval) { clearInterval(onlineInputInterval); onlineInputInterval = null; }
  document.getElementById('onlineLobby').style.display = 'block';
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'none';
  document.getElementById('onlineMobileControls').style.display = 'none';
  document.removeEventListener('keydown', onlineKeyDown);
  document.removeEventListener('keyup', onlineKeyUp);
  onlineKeys = {};
  onlineTouchShoot = false;
  onlineTouchAngle = null;
}

// ═══ GAME START ═══
function startOnlineGame(data) {
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'block';

  var canvas = document.getElementById('onlineCanvas');
  resizeOnlineCanvas(canvas);
  setupOnlineControls(canvas);

  if (isMobile()) showMobileControls();
}

function resizeOnlineCanvas(canvas) {
  var container = canvas.parentElement;
  var maxW = Math.min(800, container.clientWidth - 4);
  var scale = maxW / 800;
  canvas.style.width = maxW + 'px';
  canvas.style.height = (600 * scale) + 'px';
}

function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window;
}

// ═══ CONTROLS ═══
function onlineKeyDown(e) {
  var k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) !== -1) {
    e.preventDefault();
    onlineKeys[k] = true;
  }
}
function onlineKeyUp(e) {
  onlineKeys[e.key.toLowerCase()] = false;
}

function setupOnlineControls(canvas) {
  document.addEventListener('keydown', onlineKeyDown);
  document.addEventListener('keyup', onlineKeyUp);

  canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = 800 / rect.width;
    var scaleY = 600 / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top) * scaleY;
    onlineTouchAngle = Math.atan2(my - onlineMyPos.y, mx - onlineMyPos.x);
  });

  canvas.addEventListener('mousedown', function () { onlineTouchShoot = true; });
  canvas.addEventListener('mouseup', function () { onlineTouchShoot = false; });

  if (onlineInputInterval) clearInterval(onlineInputInterval);
  onlineInputInterval = setInterval(sendOnlineInput, 1000 / 30);
}

function showMobileControls() {
  var mc = document.getElementById('onlineMobileControls');
  mc.style.display = 'block';
  mc.innerHTML =
    '<div style="display:flex;justify-content:space-between;padding:8px 12px;gap:12px">' +
    '<div id="moveJoystick" style="width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);position:relative;touch-action:none">' +
    '<div id="moveJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.5);position:absolute;top:45px;left:45px;pointer-events:none"></div></div>' +
    '<div id="aimJoystick" style="width:140px;height:140px;border-radius:50%;background:rgba(255,50,50,0.15);border:2px solid rgba(255,50,50,0.3);position:relative;touch-action:none">' +
    '<div id="aimJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,50,50,0.5);position:absolute;top:45px;left:45px;pointer-events:none"></div></div></div>';

  setupJoystick(document.getElementById('moveJoystick'), 'moveJoystickKnob', onlineJoystick);
  setupJoystick(document.getElementById('aimJoystick'), 'aimJoystickKnob', onlineAimJoystick);
}

function setupJoystick(el, knobId, state) {
  var knob = document.getElementById(knobId);
  el.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    var rect = el.getBoundingClientRect();
    state.active = true;
    state.startX = rect.left + rect.width / 2;
    state.startY = rect.top + rect.height / 2;
    state.dx = t.clientX - state.startX;
    state.dy = t.clientY - state.startY;
    updateKnob(knob, state, el);
  }, { passive: false });

  el.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!state.active) return;
    var t = e.touches[0];
    state.dx = t.clientX - state.startX;
    state.dy = t.clientY - state.startY;
    var dist = Math.sqrt(state.dx * state.dx + state.dy * state.dy);
    if (dist > 50) { state.dx = state.dx / dist * 50; state.dy = state.dy / dist * 50; }
    updateKnob(knob, state, el);
  }, { passive: false });

  el.addEventListener('touchend', function (e) {
    e.preventDefault();
    state.active = false;
    state.dx = 0;
    state.dy = 0;
    updateKnob(knob, state, el);
  }, { passive: false });
}

function updateKnob(knob, state, el) {
  var hw = el.clientWidth / 2 - 25;
  knob.style.left = (hw + state.dx) + 'px';
  knob.style.top = (hw + state.dy) + 'px';
}

function sendOnlineInput() {
  if (!onlineState.inGame || !socket) return;

  var input = { up: false, down: false, left: false, right: false, shoot: false, attack: false };

  if (isMobile() && onlineJoystick.active) {
    if (onlineJoystick.dy < -15) input.up = true;
    if (onlineJoystick.dy > 15) input.down = true;
    if (onlineJoystick.dx < -15) input.left = true;
    if (onlineJoystick.dx > 15) input.right = true;
  } else {
    input.up = onlineKeys['w'] || onlineKeys['arrowup'] || false;
    input.down = onlineKeys['s'] || onlineKeys['arrowdown'] || false;
    input.left = onlineKeys['a'] || onlineKeys['arrowleft'] || false;
    input.right = onlineKeys['d'] || onlineKeys['arrowright'] || false;
  }

  if (isMobile() && onlineAimJoystick.active) {
    input.angle = Math.atan2(onlineAimJoystick.dy, onlineAimJoystick.dx);
    input.shoot = true;
    input.attack = true;
    if (onlineState.gameType === 'tanks') input.turretAngle = input.angle;
  } else {
    if (onlineTouchAngle !== null) input.angle = onlineTouchAngle;
    input.shoot = onlineTouchShoot || onlineKeys[' '] || false;
    input.attack = onlineTouchShoot || onlineKeys[' '] || false;
    if (onlineState.gameType === 'tanks' && onlineTouchAngle !== null) input.turretAngle = onlineTouchAngle;
  }

  socket.emit('game_input', { roomId: onlineState.roomId, playerId: onlineState.myId, input: input });
}

// ═══ RENDERING ═══
var GAME_COLORS = {
  bg: '#1a1a2e',
  wall: '#374151',
  wallStroke: '#4b5563',
  player0: '#3b82f6',
  player1: '#ef4444',
  player2: '#22c55e',
  player3: '#f59e0b',
  bullet: '#fbbf24',
  hp: '#22c55e',
  hpBg: '#374151',
  text: '#ffffff'
};

function renderOnlineGame(data) {
  var canvas = document.getElementById('onlineCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = 800, H = 600;

  data.players.forEach(function (p) {
    if (p.id === onlineState.myId) { onlineMyPos.x = p.x; onlineMyPos.y = p.y; }
  });

  ctx.fillStyle = data.state.mapColor || GAME_COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, W, H);

  if (onlineState.gameType === 'shooter') renderShooter(ctx, data, W, H);
  else if (onlineState.gameType === 'tanks') renderTanks(ctx, data, W, H);
  else if (onlineState.gameType === 'arena') renderArena(ctx, data, W, H);

  updateHUD(data);
}

function drawGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (var x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (var y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function getPlayerColor(idx) {
  var colors = [GAME_COLORS.player0, GAME_COLORS.player1, GAME_COLORS.player2, GAME_COLORS.player3];
  return colors[idx % colors.length];
}

function drawWalls(ctx, walls) {
  walls.forEach(function (w) {
    ctx.fillStyle = GAME_COLORS.wall;
    ctx.strokeStyle = GAME_COLORS.wallStroke;
    ctx.lineWidth = 2;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  });
}

function drawHP(ctx, x, y, hp, maxHp) {
  var bw = 40, bh = 5;
  ctx.fillStyle = GAME_COLORS.hpBg;
  ctx.fillRect(x - bw / 2, y - 28, bw, bh);
  ctx.fillStyle = hp > 60 ? GAME_COLORS.hp : hp > 30 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(x - bw / 2, y - 28, bw * (hp / maxHp), bh);
}

function drawName(ctx, x, y, name, isMe) {
  ctx.fillStyle = isMe ? '#fbbf24' : '#ffffff';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 33);
}

function drawBullets(ctx, bullets) {
  bullets.forEach(function (b) {
    ctx.fillStyle = GAME_COLORS.bullet;
    ctx.shadowColor = GAME_COLORS.bullet;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

// ═══ SHOOTER RENDERER ═══
function renderShooter(ctx, data, W, H) {
  var walls = data.state.items ? data.state.items.filter(function (i) { return i.type === 'wall'; }) : [];
  drawWalls(ctx, walls);
  drawBullets(ctx, data.state.bullets || []);

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(i);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(10, -3, 12, 6);

    ctx.fillStyle = isMe ? '#fbbf24' : '#e5e7eb';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Player', isMe);

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

// ═══ TANKS RENDERER ═══
function renderTanks(ctx, data, W, H) {
  drawWalls(ctx, data.state.walls || []);
  drawBullets(ctx, data.state.bullets || []);

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(p.team != null ? p.team : i);

    ctx.save();
    ctx.translate(p.x, p.y);

    var bodyAngle = p.angle || 0;
    ctx.save();
    ctx.rotate(bodyAngle);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(-16, -12, 32, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = shadeColor(color, -30);
    ctx.fillRect(-18, -14, 6, 28);
    ctx.fillRect(12, -14, 6, 28);
    ctx.restore();

    var tAngle = p.turretAngle || bodyAngle;
    ctx.save();
    ctx.rotate(tAngle);
    ctx.fillStyle = shadeColor(color, 20);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(6, -2.5, 18, 5);
    ctx.restore();

    ctx.restore();

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Tank', isMe);
  });
}

// ═══ ARENA RENDERER ═══
function renderArena(ctx, data, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 200, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 100, 0, Math.PI * 2);
  ctx.stroke();

  (data.state.projectiles || []).forEach(function (p) {
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(i);

    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(14, -2, 14, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(26, -4, 4, 8);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-6, -10, 4, 20);

    ctx.restore();

    if (p.attackCooldown > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2 * (1 - p.attackCooldown / 0.6));
      ctx.stroke();
    }

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Jangchi', isMe);
  });
}

function updateHUD(data) {
  var hud = document.getElementById('onlineHUD');
  if (!hud) return;
  var time = data.state.time || 0;
  var min = Math.floor(time / 60);
  var sec = time % 60;
  var timeStr = min + ':' + (sec < 10 ? '0' : '') + sec;

  var html = '<span style="color:var(--muted)">⏱ ' + timeStr + '</span>';
  data.players.forEach(function (p, i) {
    var color = getPlayerColor(p.team != null ? p.team : i);
    var isMe = p.id === onlineState.myId;
    html += '<span style="color:' + color + ';' + (isMe ? 'text-decoration:underline;' : '') + '">' + p.name + ': ' + p.score + '</span>';
  });
  html += '<button class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:.75rem" onclick="leaveOnlineGame()">Chiqish</button>';
  hud.innerHTML = html;
}

function leaveOnlineGame() {
  if (socket) socket.disconnect();
  socket = null;
  backToOnlineLobby();
}

function showOnlineResult(data) {
  onlineState.inGame = false;
  document.getElementById('onlineGameArea').style.display = 'none';
  document.getElementById('onlineMobileControls').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';

  var me = data.players.find(function (p) { return p.id === onlineState.myId; });
  var isWinner = data.winner === (me ? me.name : '');

  var html = '<div class="game-area" style="text-align:center;padding:30px 20px">';
  html += '<h2 style="font-size:1.8rem;margin-bottom:12px">' + (isWinner ? '🏆 Siz yutdingiz!' : data.winner === 'Durrang' ? '🤝 Durrang!' : '😤 Yutqazdingiz') + '</h2>';
  html += '<p style="font-size:1.1rem;color:var(--muted);margin-bottom:16px">G\'olib: <strong>' + data.winner + '</strong></p>';
  html += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">';
  data.players.forEach(function (p, i) {
    var color = getPlayerColor(p.team != null ? p.team : i);
    html += '<div class="stat-card" style="padding:12px 20px;text-align:center;min-width:100px;border-top:3px solid ' + color + '">';
    html += '<div style="font-weight:700">' + p.name + '</div>';
    html += '<div style="font-size:1.5rem;font-weight:900;color:' + color + '">' + p.score + '</div>';
    html += '<div style="font-size:.75rem;color:var(--muted)">+' + (p.score * 10) + ' ochko</div></div>';
  });
  html += '</div>';
  html += '<button class="btn btn-sm btn-primary" onclick="openOnlineGame(\'' + onlineState.gameType + '\',\'' + onlineState.mode + '\')">Qayta o\'ynash</button> ';
  html += '<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="backToOnlineLobby()">← Orqaga</button></div>';
  mm.innerHTML = html;
}

function shadeColor(color, percent) {
  var num = parseInt(color.replace('#', ''), 16);
  var r = Math.min(255, Math.max(0, (num >> 16) + percent));
  var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  var b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
