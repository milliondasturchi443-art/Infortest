const express = require('express');
const User = require('../models/User');
const DB = require('../data/questions');

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

    res.json({ results });
  } catch (err) {
    console.error('Results error:', err);
    res.status(500).json({ error: 'Server xatosi.' });
  }
});

module.exports = router;
