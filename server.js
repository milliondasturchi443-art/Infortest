const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const adminRoutes = require('./routes/admin');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══ MULTIPLAYER GAME SERVER ═══
const matchQueues = { shooter1v1: [], tanks1v1: [], tanks2v2: [], arena1v1: [] };
const activeRooms = {};

io.on('connection', (socket) => {
  socket.on('join_queue', (data) => {
    const { gameType, mode, player } = data;
    const qKey = gameType + mode;
    const queue = matchQueues[qKey];
    if (!queue) return;
    if (queue.find(p => p.id === player.id)) return;
    queue.push({ ...player, socketId: socket.id });
    socket.join('queue_' + qKey);
    io.to('queue_' + qKey).emit('queue_update', { count: queue.length });

    const needed = mode === '2v2' ? 4 : 2;
    if (queue.length >= needed) {
      const players = queue.splice(0, needed);
      const roomId = qKey + '_' + Date.now();
      const room = { id: roomId, gameType, mode, players: [], state: null, started: false };

      players.forEach((p, i) => {
        room.players.push({ ...p, team: mode === '2v2' ? (i < 2 ? 0 : 1) : i, ready: false });
        const ps = io.sockets.sockets.get(p.socketId);
        if (ps) { ps.leave('queue_' + qKey); ps.join(roomId); }
      });

      activeRooms[roomId] = room;
      initGameState(room);
      room.started = true;
      io.to(roomId).emit('match_found', { roomId, players: room.players, gameType, mode, state: room.state });
      startGameLoop(roomId);
    }
  });

  socket.on('leave_queue', (data) => {
    const { gameType, mode, playerId } = data;
    const qKey = gameType + mode;
    const queue = matchQueues[qKey];
    if (!queue) return;
    const idx = queue.findIndex(p => p.id === playerId);
    if (idx !== -1) queue.splice(idx, 1);
    socket.leave('queue_' + qKey);
  });

  socket.on('game_input', (data) => {
    const { roomId, playerId, input } = data;
    const room = activeRooms[roomId];
    if (!room || !room.started) return;
    const player = room.players.find(p => p.id === playerId);
    if (player) player.input = input;
  });

  socket.on('disconnect', () => {
    Object.keys(matchQueues).forEach(qKey => {
      matchQueues[qKey] = matchQueues[qKey].filter(p => p.socketId !== socket.id);
    });
    Object.keys(activeRooms).forEach(roomId => {
      const room = activeRooms[roomId];
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (p) {
        p.disconnected = true;
        if (room.players.every(pl => pl.disconnected)) {
          if (room.loopInterval) clearInterval(room.loopInterval);
          delete activeRooms[roomId];
        } else {
          io.to(roomId).emit('player_disconnected', { playerId: p.id });
        }
      }
    });
  });
});

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function isInWall(x, y, r, walls) {
  for (const w of walls) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}

function safeSpawn(W, H, walls, margin) {
  margin = margin || 25;
  for (let tries = 0; tries < 50; tries++) {
    const x = margin + Math.random() * (W - margin * 2);
    const y = margin + Math.random() * (H - margin * 2);
    if (!isInWall(x, y, 20, walls)) return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

function generateWalls(count, W, H, spawnZones) {
  const walls = [];
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const w = { x: 120 + Math.random() * (W - 240), y: 80 + Math.random() * (H - 160), w: 30 + Math.random() * 50, h: 30 + Math.random() * 50 };
      let overlapsSpawn = false;
      for (const sz of spawnZones) {
        if (rectOverlap(w.x - 30, w.y - 30, w.w + 60, w.h + 60, sz.x - 40, sz.y - 40, 80, 80)) { overlapsSpawn = true; break; }
      }
      if (!overlapsSpawn) { walls.push(w); break; }
    }
  }
  return walls;
}

function initGameState(room) {
  const W = 800, H = 600;
  if (room.gameType === 'shooter') {
    const spawnPositions = [{ x: 100, y: H / 2 }, { x: W - 100, y: H / 2 }];
    room.state = { w: W, h: H, bullets: [], items: [], time: 90 };
    room.players.forEach((p, i) => {
      const pos = spawnPositions[i] || spawnPositions[0];
      p.x = pos.x; p.y = pos.y;
      p.hp = 100;
      p.angle = i === 0 ? 0 : Math.PI;
      p.speed = 3;
      p.score = 0;
      p.lastShot = 0;
      p.weapon = 'pistol';
      p.input = {};
    });
    const walls = generateWalls(8, W, H, spawnPositions);
    walls.forEach(w => room.state.items.push({ type: 'wall', ...w }));
  } else if (room.gameType === 'tanks') {
    const spawnPositions = [{ x: 80, y: 80 }, { x: W - 80, y: H - 80 }, { x: W - 80, y: 80 }, { x: 80, y: H - 80 }];
    room.state = { w: W, h: H, bullets: [], walls: [], time: 120 };
    room.players.forEach((p, i) => {
      const pos = spawnPositions[i] || spawnPositions[0];
      p.x = pos.x; p.y = pos.y;
      p.hp = 100; p.angle = 0; p.turretAngle = 0;
      p.speed = 2.5; p.score = 0; p.lastShot = 0; p.input = {};
    });
    room.state.walls = generateWalls(10, W, H, spawnPositions);
  } else if (room.gameType === 'arena') {
    room.state = { w: W, h: H, projectiles: [], time: 90 };
    room.players.forEach((p, i) => {
      p.x = i === 0 ? 150 : W - 150;
      p.y = H / 2;
      p.hp = 100; p.angle = 0; p.speed = 3.5; p.score = 0;
      p.lastAttack = 0; p.attackCooldown = 0;
      p.input = {};
    });
  }
}

function startGameLoop(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;
  let lastTick = Date.now();
  let tickCount = 0;

  room.loopInterval = setInterval(() => {
    if (!activeRooms[roomId]) { clearInterval(room.loopInterval); return; }
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    tickCount++;

    if (tickCount % 30 === 0) {
      room.state.time = Math.max(0, room.state.time - 1);
      if (room.state.time <= 0) {
        endGame(roomId);
        return;
      }
    }

    updateGame(room, dt);
    io.to(roomId).emit('game_state', { players: room.players.map(p => ({
      id: p.id, name: p.name, team: p.team, x: p.x, y: p.y, hp: p.hp,
      angle: p.angle, turretAngle: p.turretAngle, score: p.score, weapon: p.weapon,
      attackCooldown: p.attackCooldown, disconnected: p.disconnected
    })), state: room.state });
  }, 1000 / 30);
}

function getWalls(room) {
  if (room.state.walls) return room.state.walls;
  if (room.state.items) return room.state.items.filter(i => i.type === 'wall');
  return [];
}

function collidesWall(x, y, r, walls) {
  for (const w of walls) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}

function updateGame(room, dt) {
  const W = room.state.w, H = room.state.h;
  const cdt = Math.min(dt, 0.05);
  const walls = getWalls(room);
  const R = 15;

  room.players.forEach(p => {
    if (p.disconnected || p.hp <= 0) return;
    const inp = p.input || {};
    let dx = 0, dy = 0;
    if (inp.up) dy -= 1;
    if (inp.down) dy += 1;
    if (inp.left) dx -= 1;
    if (inp.right) dx += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    dx *= p.speed * cdt * 60;
    dy *= p.speed * cdt * 60;

    // axis-separated collision
    let nx = Math.max(R, Math.min(W - R, p.x + dx));
    if (!collidesWall(nx, p.y, R, walls)) { p.x = nx; }

    let ny = Math.max(R, Math.min(H - R, p.y + dy));
    if (!collidesWall(p.x, ny, R, walls)) { p.y = ny; }

    if (inp.angle !== undefined) p.angle = inp.angle;
    if (inp.turretAngle !== undefined) p.turretAngle = inp.turretAngle;

    if (room.gameType === 'shooter' || room.gameType === 'tanks') {
      if (inp.shoot && Date.now() - p.lastShot > 300) {
        p.lastShot = Date.now();
        const a = room.gameType === 'tanks' ? (p.turretAngle != null ? p.turretAngle : p.angle) : p.angle;
        const bSpeed = room.gameType === 'tanks' ? 7 : 8;
        room.state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * bSpeed, vy: Math.sin(a) * bSpeed, owner: p.id, dmg: room.gameType === 'tanks' ? 25 : 15, life: 80 });
      }
    }
    if (room.gameType === 'arena') {
      if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - cdt);
      if (inp.attack && p.attackCooldown <= 0) {
        p.attackCooldown = 0.6;
        p.lastAttack = Date.now();
        room.state.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(p.angle) * 6, vy: Math.sin(p.angle) * 6, owner: p.id, dmg: 20, life: 40 });
      }
    }
  });

  // update bullets
  const bulletList = room.state.bullets || [];
  for (let i = bulletList.length - 1; i >= 0; i--) {
    const b = bulletList[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bulletList.splice(i, 1); continue; }
    if (collidesWall(b.x, b.y, 2, walls)) { bulletList.splice(i, 1); continue; }

    let hit = false;
    room.players.forEach(p => {
      if (hit || p.id === b.owner || p.hp <= 0 || p.disconnected) return;
      if (room.mode === '2v2') {
        const owner = room.players.find(pl => pl.id === b.owner);
        if (owner && owner.team === p.team) return;
      }
      const dist = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (dist < 18) {
        p.hp -= b.dmg;
        hit = true;
        if (p.hp <= 0) {
          p.hp = 0;
          const shooter = room.players.find(pl => pl.id === b.owner);
          if (shooter) shooter.score++;
          setTimeout(() => { respawnPlayer(room, p); }, 2000);
        }
      }
    });
    if (hit) bulletList.splice(i, 1);
  }

  // update projectiles (arena)
  const projList = room.state.projectiles || [];
  for (let i = projList.length - 1; i >= 0; i--) {
    const b = projList[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { projList.splice(i, 1); continue; }

    let hit = false;
    room.players.forEach(p => {
      if (hit || p.id === b.owner || p.hp <= 0 || p.disconnected) return;
      const dist = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (dist < 18) {
        p.hp -= b.dmg;
        hit = true;
        if (p.hp <= 0) {
          p.hp = 0;
          const attacker = room.players.find(pl => pl.id === b.owner);
          if (attacker) attacker.score++;
          setTimeout(() => { respawnPlayer(room, p); }, 2000);
        }
      }
    });
    if (hit) projList.splice(i, 1);
  }
}

function respawnPlayer(room, p) {
  const W = room.state.w, H = room.state.h;
  const walls = getWalls(room);
  const pos = safeSpawn(W, H, walls, 40);
  p.hp = 100;
  p.x = pos.x;
  p.y = pos.y;
}

function endGame(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;
  if (room.loopInterval) clearInterval(room.loopInterval);
  let winner = null;
  if (room.mode === '2v2') {
    const team0 = room.players.filter(p => p.team === 0).reduce((s, p) => s + p.score, 0);
    const team1 = room.players.filter(p => p.team === 1).reduce((s, p) => s + p.score, 0);
    winner = team0 > team1 ? 'Team 1' : team1 > team0 ? 'Team 2' : 'Durrang';
  } else {
    const sorted = room.players.slice().sort((a, b) => b.score - a.score);
    winner = sorted[0].score > (sorted[1]?.score || 0) ? sorted[0].name : 'Durrang';
  }
  io.to(roomId).emit('game_over', { winner, players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score, team: p.team })) });

  room.players.forEach(p => {
    const pts = p.score * 10;
    if (pts > 0 && p.id) {
      User.findById(p.id).then(u => {
        if (u) { u.gamePoints = (u.gamePoints || 0) + pts; u.gamesPlayed = (u.gamesPlayed || 0) + 1; u.save(); }
      }).catch(() => {});
    }
  });

  setTimeout(() => { delete activeRooms[roomId]; }, 10000);
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function seedAdmin() {
  try {
    const adminLogin = 'admin';
    const adminEmail = 'gamingalexuz@gmail.com';
    let existing = await User.findOne({ login: adminLogin });
    if (!existing) existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      await User.create({
        name: 'Admin',
        login: adminLogin,
        email: adminEmail,
        password: '201018102510',
        role: 'admin',
        school: '6-maktab',
        region: 'Namangan, Chortoq',
      });
      console.log('Admin user created');
    } else {
      if (existing.role !== 'admin') existing.role = 'admin';
      if (!existing.login || existing.login !== adminLogin) existing.login = adminLogin;
      await existing.save();
      console.log('Admin ready (login: admin)');
    }
  } catch (err) {
    console.error('Seed admin error:', err.message);
  }
}

async function migrateLogins() {
  try {
    // Drop old email unique index if it exists
    try {
      await User.collection.dropIndex('email_1');
      console.log('Dropped old email_1 index');
    } catch (e) { /* index may not exist */ }
    const usersWithoutLogin = await User.find({ $or: [{ login: { $exists: false } }, { login: '' }, { login: null }] });
    for (const u of usersWithoutLogin) {
      u.login = u.email ? u.email.split('@')[0] + '_' + u._id.toString().slice(-4) : 'user_' + u._id.toString().slice(-6);
      await u.save();
    }
    if (usersWithoutLogin.length > 0) console.log('Migrated ' + usersWithoutLogin.length + ' users to login system');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
  })
  .then(async () => {
    console.log('MongoDB connected');
    await migrateLogins();
    await seedAdmin();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.error('Server is running but database is unavailable.');
  });
