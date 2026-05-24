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

app.get('*', (req, res) => {
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

function initGameState(room) {
  const W = 800, H = 600;
  if (room.gameType === 'shooter') {
    room.state = { w: W, h: H, bullets: [], items: [], time: 90 };
    room.players.forEach((p, i) => {
      p.x = i === 0 ? 100 : W - 100;
      p.y = H / 2;
      p.hp = 100;
      p.angle = i === 0 ? 0 : Math.PI;
      p.speed = 3;
      p.score = 0;
      p.lastShot = 0;
      p.weapon = 'pistol';
      p.input = {};
    });
    for (let i = 0; i < 8; i++) {
      room.state.items.push({ type: 'wall', x: 100 + Math.random() * (W - 200), y: 100 + Math.random() * (H - 200), w: 20 + Math.random() * 60, h: 20 + Math.random() * 60 });
    }
  } else if (room.gameType === 'tanks') {
    room.state = { w: W, h: H, bullets: [], walls: [], time: 120 };
    room.players.forEach((p, i) => {
      const positions = [{x:80,y:80},{x:W-80,y:H-80},{x:W-80,y:80},{x:80,y:H-80}];
      const pos = positions[i] || positions[0];
      p.x = pos.x; p.y = pos.y;
      p.hp = 100; p.angle = 0; p.turretAngle = 0;
      p.speed = 2; p.score = 0; p.lastShot = 0; p.input = {};
    });
    for (let i = 0; i < 12; i++) {
      room.state.walls.push({ x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120), w: 30 + Math.random() * 50, h: 30 + Math.random() * 50 });
    }
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

function updateGame(room, dt) {
  const W = room.state.w, H = room.state.h;
  const spd = dt * 60;

  room.players.forEach(p => {
    if (p.disconnected || p.hp <= 0) return;
    const inp = p.input || {};
    let dx = 0, dy = 0;
    if (inp.up) dy -= p.speed * spd;
    if (inp.down) dy += p.speed * spd;
    if (inp.left) dx -= p.speed * spd;
    if (inp.right) dx += p.speed * spd;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }

    let nx = p.x + dx, ny = p.y + dy;
    nx = Math.max(15, Math.min(W - 15, nx));
    ny = Math.max(15, Math.min(H - 15, ny));

    const walls = room.state.walls || room.state.items?.filter(i => i.type === 'wall') || [];
    let blocked = false;
    walls.forEach(w => {
      if (nx > w.x - 15 && nx < w.x + w.w + 15 && ny > w.y - 15 && ny < w.y + w.h + 15) blocked = true;
    });
    if (!blocked) { p.x = nx; p.y = ny; }

    if (inp.angle !== undefined) p.angle = inp.angle;
    if (inp.turretAngle !== undefined) p.turretAngle = inp.turretAngle;

    if (room.gameType === 'shooter' || room.gameType === 'tanks') {
      if (inp.shoot && Date.now() - p.lastShot > 300) {
        p.lastShot = Date.now();
        const a = room.gameType === 'tanks' ? (p.turretAngle || p.angle) : p.angle;
        const bSpeed = room.gameType === 'tanks' ? 7 : 8;
        room.state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * bSpeed, vy: Math.sin(a) * bSpeed, owner: p.id, dmg: room.gameType === 'tanks' ? 25 : 15, life: 80 });
      }
    }
    if (room.gameType === 'arena') {
      if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - dt);
      if (inp.attack && p.attackCooldown <= 0) {
        p.attackCooldown = 0.6;
        p.lastAttack = Date.now();
        room.state.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(p.angle) * 6, vy: Math.sin(p.angle) * 6, owner: p.id, dmg: 20, life: 40 });
      }
    }
  });

  const bullets = room.state.bullets || room.state.projectiles || [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * spd; b.y += b.vy * spd; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bullets.splice(i, 1); continue; }

    const walls = room.state.walls || room.state.items?.filter(it => it.type === 'wall') || [];
    let hitWall = false;
    walls.forEach(w => { if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) hitWall = true; });
    if (hitWall) { bullets.splice(i, 1); continue; }

    room.players.forEach(p => {
      if (p.id === b.owner || p.hp <= 0 || p.disconnected) return;
      if (room.mode === '2v2') {
        const owner = room.players.find(pl => pl.id === b.owner);
        if (owner && owner.team === p.team) return;
      }
      const dist = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (dist < 18) {
        p.hp -= b.dmg;
        b.life = 0;
        if (p.hp <= 0) {
          p.hp = 0;
          const shooter = room.players.find(pl => pl.id === b.owner);
          if (shooter) shooter.score++;
          setTimeout(() => { respawnPlayer(room, p); }, 2000);
        }
      }
    });
    if (b.life <= 0) bullets.splice(i, 1);
  }
}

function respawnPlayer(room, p) {
  const W = room.state.w, H = room.state.h;
  p.hp = 100;
  p.x = 50 + Math.random() * (W - 100);
  p.y = 50 + Math.random() * (H - 100);
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
