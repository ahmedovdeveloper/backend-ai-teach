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
 *         level:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *             enum: [ru, uz, en]
 * 
 *     UserResponse:
 *       type: object
 *       properties:
 *         id: { type: string, example: "671f8c2a9d8b1c2a8f9e1d2a" }
 *         email: { type: string, example: "user@example.com" }
 *         name: { type: string, example: "Алішер Ісмаїлов" }
 *         role: { type: string, enum: [user, admin], example: "user" }
 *         lessons: { type: array, items: { $ref: '#/components/schemas/Lesson' } }
 *         createdAt: { type: string, format: date-time }
 */

// Генерація JWT
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
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               lessons: { type: array, items: { $ref: '#/components/schemas/Lesson' } }
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
 *     summary: Увійти в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Успішний вхід }
 *       400: { description: Невірні дані }
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
 *     summary: Отримати поточного користувача
 *     description: Токен береться з cookie або заголовка Authorization
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Дані користувача
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       401: { description: Не авторизований }
 *       404: { description: Користувач не знайдений }
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
    console.error('GET /me error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Вийти з системи
 *     description: Очищає httpOnly cookie `token`. Body не потрібен.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Успішний вихід
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Вихід успішний" }
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/' // важливо!
  });

  res.json({ message: 'Вихід успішний' });
});

module.exports = router;