const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Ismingizni kiriting.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: "To'g'ri email kiriting." });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Parol kamida 6 ta belgi bo'lishi kerak." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Bu email allaqachon ro'yxatdan o'tgan." });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    const results = {};
    if (user.results) {
      user.results.forEach((val, key) => {
        results[key] = val;
      });
    }

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      results,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase()?.trim() });
    if (!user) {
      return res
        .status(401)
        .json({ error: "Email yoki parol noto'g'ri." });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res
        .status(401)
        .json({ error: "Email yoki parol noto'g'ri." });
    }

    const results = {};
    if (user.results) {
      user.results.forEach((val, key) => {
        results[key] = val;
      });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      results,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

module.exports = router;
