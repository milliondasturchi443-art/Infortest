const express = require('express');
const User = require('../models/User');
const DB = require('../data/questions');
const { checkAchievements } = require('./auth');

const router = express.Router();

router.get('/questions', (req, res) => {
  const safeDB = {};
  for (const [sinf, data] of Object.entries(DB)) {
    safeDB[sinf] = {
      label: data.label,
      tests: data.tests.map((t) => ({
        title: t.title,
        topic: t.topic,
        questions: t.questions.map((q) => ({
          q: q.q,
          opts: q.opts,
        })),
      })),
    };
  }
  res.json(safeDB);
});

router.post('/submit', async (req, res) => {
  try {
    const { userId, sinf, testIdx, answers } = req.body;

    if (!userId || !sinf || testIdx == null || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq emas." });
    }

    const sinfData = DB[sinf];
    if (!sinfData || !sinfData.tests[testIdx]) {
      return res.status(400).json({ error: 'Sinf yoki test topilmadi.' });
    }

    const test = sinfData.tests[testIdx];
    const questions = test.questions;
    let score = 0;

    answers.forEach((ans, i) => {
      if (i < questions.length && ans === questions[i].a) {
        score++;
      }
    });

    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const key = `${sinf}_${testIdx}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    user.results.set(key, pct);
    user.totalTests += 1;
    user.totalCorrect += score;
    user.totalQuestions += total;
    user.testHistory.push({
      sinf,
      testIdx,
      testTitle: test.title,
      topic: test.topic,
      score,
      total,
      pct,
      date: new Date(),
    });
    checkAchievements(user);
    await user.save();

    res.json({ score, total, pct, key });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/results/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    const results = {};
    if (user.results) {
      user.results.forEach((val, key) => {
        results[key] = val;
      });
    }

    res.json({
      results,
      totalTests: user.totalTests,
      totalCorrect: user.totalCorrect,
      totalQuestions: user.totalQuestions,
    });
  } catch (err) {
    console.error('Results error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ totalTests: { $gt: 0 } })
      .sort({ totalCorrect: -1 })
      .limit(50)
      .select('name school region grade totalTests totalCorrect totalQuestions');

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      name: u.name,
      school: u.school,
      region: u.region,
      grade: u.grade,
      totalTests: u.totalTests,
      totalCorrect: u.totalCorrect,
      totalQuestions: u.totalQuestions,
      avgPct:
        u.totalQuestions > 0
          ? Math.round((u.totalCorrect / u.totalQuestions) * 100)
          : 0,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ totalTests: { $gt: 0 } });
    const allUsers = await User.find({ totalTests: { $gt: 0 } }).select(
      'totalTests totalCorrect totalQuestions'
    );

    let totalTestsTaken = 0;
    let totalCorrectAll = 0;
    let totalQuestionsAll = 0;

    allUsers.forEach((u) => {
      totalTestsTaken += u.totalTests;
      totalCorrectAll += u.totalCorrect;
      totalQuestionsAll += u.totalQuestions;
    });

    res.json({
      totalUsers,
      activeUsers,
      totalTestsTaken,
      totalCorrectAll,
      totalQuestionsAll,
      avgPct:
        totalQuestionsAll > 0
          ? Math.round((totalCorrectAll / totalQuestionsAll) * 100)
          : 0,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

module.exports = router;
