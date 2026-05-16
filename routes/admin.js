const express = require('express');
const User = require('../models/User');

const router = express.Router();

async function requireAdmin(req, res, next) {
  const adminId = req.headers['x-admin-id'];
  if (!adminId) {
    return res.status(401).json({ error: 'Admin autentifikatsiya kerak.' });
  }
  try {
    const user = await User.findById(adminId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin huquqi yo\'q.' });
    }
    req.admin = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Noto\'g\'ri admin ID.' });
  }
}

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password');

    const list = users.map((u) => ({
      id: u._id,
      name: u.name,
      login: u.login,
      school: u.school,
      region: u.region,
      grade: u.grade,
      role: u.role,
      totalTests: u.totalTests,
      totalCorrect: u.totalCorrect,
      totalQuestions: u.totalQuestions,
      avgPct:
        u.totalQuestions > 0
          ? Math.round((u.totalCorrect / u.totalQuestions) * 100)
          : 0,
      createdAt: u.createdAt,
    }));

    res.json({ users: list, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Admin o\'chirib bo\'lmaydi.' });
    }
    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: 'Foydalanuvchi o\'chirildi.' });
  } catch (err) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ totalTests: { $gt: 0 } });

    const schoolStats = await User.aggregate([
      { $match: { school: { $ne: '' } } },
      {
        $group: {
          _id: '$school',
          count: { $sum: 1 },
          totalTests: { $sum: '$totalTests' },
          totalCorrect: { $sum: '$totalCorrect' },
          totalQuestions: { $sum: '$totalQuestions' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const gradeStats = await User.aggregate([
      { $match: { grade: { $ne: '' } } },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
          totalTests: { $sum: '$totalTests' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name login school grade createdAt totalTests');

    res.json({
      totalUsers,
      activeUsers,
      schoolStats: schoolStats.map((s) => ({
        school: s._id,
        count: s.count,
        totalTests: s.totalTests,
        avgPct:
          s.totalQuestions > 0
            ? Math.round((s.totalCorrect / s.totalQuestions) * 100)
            : 0,
      })),
      gradeStats: gradeStats.map((g) => ({
        grade: g._id,
        count: g.count,
        totalTests: g.totalTests,
      })),
      recentUsers: recentUsers.map((u) => ({
        name: u.name,
        login: u.login,
        school: u.school,
        grade: u.grade,
        totalTests: u.totalTests,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

module.exports = router;
