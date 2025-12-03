// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const auth = require('../../middleware/Auth');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Аутентифікація та управління користувачами
 */

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'your_strong_secret_here_2025',
    { expiresIn: '7d' }
  );
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Реєстрація користувача
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               lessons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     theme: { type: string, enum: [english, math, science] }
 *                     level: { type: string, enum: [beginner, intermediate, advanced] }
 *                     languages: { type: array, items: { type: string, enum: [ru, uz, en] } }
 *     responses:
 *       201: { description: Успішно зареєстровано }
 *       400: { description: Помилка валідації або email зайнятий }
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Невірний email'),
    body('password').isLength({ min: 8 }).withMessage('Пароль мінімум 8 символів'),
    body('name').trim().notEmpty().withMessage("Ім'я обов'язкове"),
    body('lessons').optional().isArray(),
    body('lessons.*.theme').optional().isString(),
    body('lessons.*.level').optional().isIn(['beginner', 'intermediate', 'advanced']),
    body('lessons.*.languages').optional().isArray().withMessage('Мови — масив'),
    body('lessons.*.languages.*').optional().isIn(['ru', 'uz', 'en'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, lessons = [] } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      }

      const user = new User({
        email,
        password,
        name,
        lessons // ← зберігаємо уроки одразу при реєстрації
      });

      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const token = generateToken(user);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 днів
      });

      res.status(201).json({
        message: 'Реєстрація успішна',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lessons: user.lessons
        }
      });
    } catch (err) {
      console.error('Register error:', err);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Email вже використовується' });
      }
      res.status(500).json({ message: 'Помилка сервера' });
    }
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Вхід у систему
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: 'Невірний email або пароль' });
      }

      const token = generateToken(user);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        message: 'Вхід успішний',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lessons: user.lessons
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Помилка сервера' });
    }
  }
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Отримати поточного користувача
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Вихід
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Вихід успішний' });
});

module.exports = router;