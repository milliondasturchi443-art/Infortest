const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, school, region, grade } = req.body;

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
      school: school || '',
      region: region || '',
      grade: grade || '',
    });

    checkAchievements(user);
    await user.save();

    res.status(201).json(user.toPublic());
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

    res.json(user.toPublic());
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }
    res.json(user.toPublic());
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.put('/profile/:userId', async (req, res) => {
  try {
    const { name, school, region, grade } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (school !== undefined) user.school = school;
    if (region !== undefined) user.region = region;
    if (grade !== undefined) user.grade = grade;

    await user.save();
    res.json(user.toPublic());
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.put('/password/:userId', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ error: "Joriy parol noto'g'ri." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Yangi parol kamida 6 ta belgi bo'lishi kerak." });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Parol muvaffaqiyatli o'zgartirildi." });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.put('/settings/:userId', async (req, res) => {
  try {
    const { theme, accentColor, fontSize } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    if (theme && ['light', 'dark'].includes(theme)) user.theme = theme;
    if (accentColor) user.accentColor = accentColor;
    if (fontSize && ['small', 'medium', 'large'].includes(fontSize)) user.fontSize = fontSize;

    await user.save();
    res.json(user.toPublic());
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

function checkAchievements(user) {
  const achs = new Set(user.achievements || []);
  if (user.totalTests >= 1) achs.add('first_test');
  if (user.totalTests >= 5) achs.add('test_5');
  if (user.totalTests >= 10) achs.add('test_10');
  if (user.totalTests >= 25) achs.add('test_25');
  if (user.totalQuestions > 0 && (user.totalCorrect / user.totalQuestions) >= 0.9) achs.add('genius');
  if (user.totalQuestions > 0 && (user.totalCorrect / user.totalQuestions) === 1) achs.add('perfect');

  const results = {};
  if (user.results) user.results.forEach((v, k) => { results[k] = v; });
  const passed = Object.values(results).filter((p) => p >= 70).length;
  if (passed >= 5) achs.add('pass_5');
  if (passed >= 10) achs.add('pass_10');
  if (passed >= 24) achs.add('master');

  user.achievements = Array.from(achs);
}

module.exports = router;
module.exports.checkAchievements = checkAchievements;
