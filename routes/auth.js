const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, login, password, school, region, grade } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Ismingizni kiriting.' });
    }
    if (!login || login.trim().length < 3) {
      return res.status(400).json({ error: 'Login kamida 3 ta belgi.' });
    }
    if (/[^a-zA-Z0-9._-]/.test(login.trim())) {
      return res.status(400).json({ error: 'Login faqat harf, raqam, nuqta, chiziq.' });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Parol kamida 6 ta belgi bo'lishi kerak." });
    }

    const existing = await User.findOne({ login: login.toLowerCase().trim() });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Bu login allaqachon band." });
    }

    const user = await User.create({
      name: name.trim(),
      login: login.toLowerCase().trim(),
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
    const { login, password } = req.body;

    const loginVal = login?.toLowerCase()?.trim();
    let user = await User.findOne({ login: loginVal });
    if (!user) user = await User.findOne({ email: loginVal });
    if (!user) {
      return res
        .status(401)
        .json({ error: "Login yoki parol noto'g'ri." });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res
        .status(401)
        .json({ error: "Login yoki parol noto'g'ri." });
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

  const results = {};
  if (user.results) user.results.forEach((v, k) => { results[k] = v; });
  const allPcts = Object.values(results);
  if (allPcts.some((p) => p === 100)) achs.add('perfect');
  const passed = allPcts.filter((p) => p >= 70).length;
  if (passed >= 5) achs.add('pass_5');
  if (passed >= 10) achs.add('pass_10');
  if (passed >= 24) achs.add('master');

  // Streak achievements
  if ((user.streak || 0) >= 3) achs.add('streak_3');
  if ((user.streak || 0) >= 7) achs.add('streak_7');

  // Level achievements
  if ((user.level || 1) >= 5) achs.add('level_5');
  if ((user.level || 1) >= 10) achs.add('level_10');

  // Multi-subject: check if user has results in 3+ different subjects
  const subjects = new Set();
  Object.keys(results).forEach((key) => {
    const subj = key.split('_')[0];
    if (['informatika', 'matematika', 'fizika', 'kimyo'].includes(subj)) {
      subjects.add(subj);
    }
  });
  if (subjects.size >= 3) achs.add('multi_subject');

  user.achievements = Array.from(achs);
}

// ═══ FRIENDS ═══
router.post('/friend/add', async (req, res) => {
  try {
    const { userId, friendCode } = req.body;
    if (!userId || !friendCode) return res.status(400).json({ error: 'userId va friendCode kerak.' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    const friend = await User.findOne({ friendCode: friendCode.toUpperCase() });
    if (!friend) return res.status(404).json({ error: 'Kod topilmadi. Tekshirib qaytadan kiriting.' });
    if (friend._id.equals(user._id)) return res.status(400).json({ error: 'O\'zingizni qo\'sha olmaysiz.' });
    if (user.friends.some(f => f.equals(friend._id))) return res.status(400).json({ error: 'Bu do\'st allaqachon qo\'shilgan.' });
    user.friends.push(friend._id);
    if (!friend.friends.some(f => f.equals(user._id))) friend.friends.push(user._id);
    await user.save();
    await friend.save();
    res.json({ ok: true, friend: { id: friend._id, name: friend.name, grade: friend.grade, friendCode: friend.friendCode } });
  } catch (err) {
    console.error('Friend add error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/friends/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('friends', 'name grade school friendCode gamePoints');
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    const friends = (user.friends || []).map(f => ({
      id: f._id, name: f.name, grade: f.grade, school: f.school,
      friendCode: f.friendCode, gamePoints: f.gamePoints || 0
    }));
    res.json(friends);
  } catch (err) {
    console.error('Friends list error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.post('/friend/remove', async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    if (user) { user.friends = user.friends.filter(f => !f.equals(friendId)); await user.save(); }
    if (friend) { friend.friends = friend.friends.filter(f => !f.equals(userId)); await friend.save(); }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

module.exports = router;
module.exports.checkAchievements = checkAchievements;
