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
    const adminEmail = 'gamingalexuz@gmail.com';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      await User.create({
        name: 'Admin',
        email: adminEmail,
        password: '201018102510',
        role: 'admin',
        school: '6-maktab',
        region: 'Namangan, Chortoq',
      });
      console.log('Admin user created');
    } else if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('Admin role updated');
    }
  } catch (err) {
    console.error('Seed admin error:', err.message);
  }
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
  })
  .then(async () => {
    console.log('MongoDB connected');
    await seedAdmin();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.error('Server is running but database is unavailable.');
  });
