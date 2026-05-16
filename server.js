const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const adminRoutes = require('./routes/admin');
const User = require('./models/User');

const app = express();
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
