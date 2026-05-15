const express = require('express');
const User = require('../models/User');
const DB_INFO = require('../data/questions');
const DB_MATH = require('../data/matematika');
const DB_PHYS = require('../data/fizika');
const DB_CHEM = require('../data/kimyo');
const { checkAchievements } = require('./auth');

const router = express.Router();

const SUBJECTS = {
  informatika: DB_INFO,
  matematika: DB_MATH,
  fizika: DB_PHYS,
  kimyo: DB_CHEM,
};

function countTests(db) {
  let c = 0;
  for (const s of Object.values(db)) c += s.tests.length;
  return c;
}

router.get('/questions', (req, res) => {
  const subject = req.query.subject || 'informatika';
  const DB = SUBJECTS[subject];
  if (!DB) return res.status(400).json({ error: 'Fan topilmadi.' });

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

router.get('/subjects', (req, res) => {
  const info = {};
  for (const [key, db] of Object.entries(SUBJECTS)) {
    const grades = Object.keys(db).sort();
    info[key] = {
      grades,
      totalTests: countTests(db),
    };
  }
  res.json(info);
});

router.post('/submit', async (req, res) => {
  try {
    const { userId, sinf, testIdx, answers, subject } = req.body;
    const subjectKey = subject || 'informatika';

    if (!userId || !sinf || testIdx == null || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq emas." });
    }

    const DB = SUBJECTS[subjectKey];
    if (!DB) return res.status(400).json({ error: 'Fan topilmadi.' });

    const sinfData = DB[sinf];
    if (!sinfData || !sinfData.tests[testIdx]) {
      return res.status(400).json({ error: 'Sinf yoki test topilmadi.' });
    }

    const test = sinfData.tests[testIdx];
    const questions = test.questions;
    let score = 0;
    const correctAnswers = [];

    answers.forEach((ans, i) => {
      if (i < questions.length) {
        const isCorrect = ans === questions[i].a;
        if (isCorrect) score++;
        correctAnswers.push({
          correct: questions[i].a,
          userAnswer: ans,
          isCorrect,
        });
      }
    });

    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const key = `${subjectKey}_${sinf}_${testIdx}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    user.results.set(key, pct);
    user.totalTests += 1;
    user.totalCorrect += score;
    user.totalQuestions += total;

    // XP system: base 10 XP + bonus for high scores
    let xpEarned = 10;
    if (pct >= 90) xpEarned = 50;
    else if (pct >= 70) xpEarned = 30;
    else if (pct >= 50) xpEarned = 20;
    user.xp = (user.xp || 0) + xpEarned;
    user.level = Math.floor((user.xp || 0) / 100) + 1;

    // Streak system
    const today = new Date().toDateString();
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).toDateString() : null;
    if (lastActive !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastActive === yesterday) {
        user.streak = (user.streak || 0) + 1;
      } else if (lastActive !== today) {
        user.streak = 1;
      }
      user.lastActiveDate = new Date();
    }
    if ((user.streak || 0) > (user.bestStreak || 0)) {
      user.bestStreak = user.streak;
    }

    user.testHistory.push({
      sinf,
      testIdx,
      testTitle: test.title,
      topic: test.topic,
      subject: subjectKey,
      score,
      total,
      pct,
      date: new Date(),
    });
    checkAchievements(user);
    await user.save();

    res.json({ score, total, pct, key, xpEarned, correctAnswers, streak: user.streak || 1, level: user.level || 1, xp: user.xp || 0 });
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
      .select('name school region grade totalTests totalCorrect totalQuestions xp level streak');

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
      xp: u.xp || 0,
      level: u.level || 1,
      streak: u.streak || 0,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

router.get('/daily-challenge', (req, res) => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const subjectKeys = Object.keys(SUBJECTS);
  const subjectIdx = seed % subjectKeys.length;
  const subjectKey = subjectKeys[subjectIdx];
  const DB = SUBJECTS[subjectKey];
  const sinfKeys = Object.keys(DB);
  const sinfIdx = seed % sinfKeys.length;
  const sinfKey = sinfKeys[sinfIdx];
  const sinfData = DB[sinfKey];
  const testIdx = seed % sinfData.tests.length;
  const test = sinfData.tests[testIdx];

  res.json({
    subject: subjectKey,
    sinf: sinfKey,
    testIdx,
    title: test.title,
    topic: test.topic,
    totalQuestions: test.questions.length,
    bonusXP: 25,
  });
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
