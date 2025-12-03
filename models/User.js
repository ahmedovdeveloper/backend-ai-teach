// models/User.js
const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  theme: {
    type: String,
    required: true,
    trim: true,
    enum: ['english', 'math', 'science', 'history', 'programming', 'other'] // додай свої теми
  },
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  languages: {
    type: [String],
    required: true,
    enum: ['ru', 'uz', 'en'],
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'Оберіть хоча б одну мову'
    }
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    trim: true, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  lessons: [lessonSchema], // ← твоє нове поле
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('User', userSchema);