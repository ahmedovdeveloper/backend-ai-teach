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
 *   - name: Auth
 *     description: Аутентифікація та управління користувачами
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 *   schemas:
 *     Lesson:
 *       type: object
 *       properties:
 *         theme:
 *           type: string
 *           enum: [english, math, science, history, programming, other]
 *           example: english
 *         level:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: beginner
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *             enum: [ru, uz, en]
 *           example: ["uz", "ru"]
 * 
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 671f8c2a9d8b1c2a8f9e1d2a
 *         email:
 *           type: string
 *           example: user@example.com
 *         name:
 *           type: string
 *           example: Алішер Ісмаїлов
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           example: user
 *         lessons:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Lesson'
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// Генерація токена
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'your_very_strong_secret_2025',
    { expiresIn: '7d' }
  );
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Реєстрація нового користувача
 *     tags: [Auth]
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
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alisher@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: MyPass123!
 *               name:
 *                 type: string
 *                 example: Алішер Ісмаїлов
 *               lessons:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Lesson'
 *     responses:
 *       201:
 *         description: Користувач успішно створений
 *         content:
 *           application/json:
 *             example:
 *               message: Реєстрація успішна
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *               user:
 *                 id: 671f8c2a9d8b1c2a8f9e1d2a
 *                 email: alisher@example.com
 *                 name: Алішер Ісмаїлов
 *                 role: user
 *                 lessons: []
 *                 createdAt: "2025-04-05T10:00:00.000Z"
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Невірний email'),
    body('password').isLength({ min: 8 }).withMessage('Пароль має бути мінімум 8 символів'),
    body('name').trim().notEmpty().withMessage("Ім'я обов'язкове"),
    body('lessons').optional().isArray(),
    body('lessons.*.theme').optional().isString(),
    body('lessons.*.level').optional().isIn(['beginner', 'intermediate', 'advanced']),
    body('lessons.*.languages').optional().isArray(),
    body('lessons.*.languages.*').optional().isIn(['ru', 'uz', 'en'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, lessons = [] } = req.body;

    try {
      if (await User.findOne({ email })) {
        return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      }

      const user = new User({ email, password, name, lessons });
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);
      await user.save();

      const token = generateToken(user);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(201).json({
        message: 'Реєстрація успішна',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lessons: user.lessons,
          createdAt: user.createdAt
        }
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Помилка сервера' });
    }
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Увійти в акаунт
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Успішний вхід
 *       400:
 *         description: Невірний email або пароль
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Невірний email'),
    body('password').exists().withMessage('Пароль обов’язковий')
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
          lessons: user.lessons,
          createdAt: user.createdAt
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
 *     summary: Отримати дані поточного користувача
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Дані авторизованого користувача
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        lessons: user.lessons,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Вийти з акаунта (очистити куку)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Успішний вихід
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