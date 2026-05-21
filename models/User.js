const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const testHistorySchema = new mongoose.Schema(
  {
    sinf: String,
    testIdx: Number,
    testTitle: String,
    topic: String,
    subject: { type: String, default: 'informatika' },
    score: Number,
    total: Number,
    pct: Number,
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    login: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    school: { type: String, default: '' },
    region: { type: String, default: '' },
    grade: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    results: { type: Map, of: Number, default: {} },
    testHistory: { type: [testHistorySchema], default: [] },
    totalTests: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    accentColor: { type: String, default: '#4361ee' },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    achievements: { type: [String], default: [] },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },
    gamePoints: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function () {
  const results = {};
  if (this.results) {
    this.results.forEach((val, key) => {
      results[key] = val;
    });
  }
  return {
    id: this._id,
    name: this.name,
    login: this.login,
    email: this.email || '',
    school: this.school,
    region: this.region,
    grade: this.grade,
    role: this.role,
    results,
    testHistory: this.testHistory || [],
    totalTests: this.totalTests,
    totalCorrect: this.totalCorrect,
    totalQuestions: this.totalQuestions,
    theme: this.theme,
    accentColor: this.accentColor,
    fontSize: this.fontSize,
    achievements: this.achievements || [],
    xp: this.xp || 0,
    level: this.level || 1,
    streak: this.streak || 0,
    bestStreak: this.bestStreak || 0,
    lastActiveDate: this.lastActiveDate,
    gamePoints: this.gamePoints || 0,
    gamesPlayed: this.gamesPlayed || 0,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
