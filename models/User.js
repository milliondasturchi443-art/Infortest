const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    school: { type: String, default: '' },
    region: { type: String, default: '' },
    grade: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    results: { type: Map, of: Number, default: {} },
    totalTests: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
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
    email: this.email,
    school: this.school,
    region: this.region,
    grade: this.grade,
    role: this.role,
    results,
    totalTests: this.totalTests,
    totalCorrect: this.totalCorrect,
    totalQuestions: this.totalQuestions,
  };
};

module.exports = mongoose.model('User', userSchema);
