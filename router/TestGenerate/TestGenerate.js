// routes/test-generator.js — УНИВЕРСАЛЬНЫЙ ТЕСТ НА ЛЮБОЙ ПРЕДМЕТ (DeepSeek + OpenAI SDK)
const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "sk-f2f3477665834fe8848b8657c74d065a", // работает без ключа!
});

/**
 * @swagger
 * /test/generate:
 *   post:
 *     summary: Сгенерировать тест по ЛЮБОМУ предмету (DeepSeek AI)
 *     tags: [Test Generator]
 *     description: Работает на русском, узбекском, английском и любом языке!
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [q]
 *             properties:
 *               q:
 *                 type: string
 *                 example: "Python programming"
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 default: beginner
 *               lang:
 *                 type: string
 *                 enum: [ru, uz, en]
 *                 default: ru
 *     responses:
 *       200:
 *         description: Тест из 10 вопросов
 */

router.post("/generate", async (req, res) => {
  const { q: topic, level = "beginner", lang = "ru" } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Укажи тему (q)" });
  }

  const levelNames = {
    beginner: { ru: "начальный", en: "beginner", uz: "boshlang'ich" },
    intermediate: { ru: "средний", en: "intermediate", uz: "o'rta daraja" },
    advanced: { ru: "продвинутый", en: "advanced", uz: "murakkab" }
  };

  const langNames = {
    ru: "русский",
    en: "английский",
    uz: "узбекский"
  };

  const prompt = `
Ты — профессиональный учитель. Составь тест из 10 вопросов с выбором одного правильного ответа (4 варианта: A, B, C, D).

Тема: ${topic}
Уровень: ${levelNames[level][lang] || levelNames[level].ru}
Язык вопросов: ${langNames[lang]}

Формат — только чистый JSON массив:

[
  {
    "question": "2 + 2 = ?",
    "options": ["A) 3", "B) 4", "C) 5", "D) 6"],
    "correct": 1
  }
]

10 вопросов. Правильный ответ — индекс от 0 до 3.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Ты генерируешь только валидный JSON. Никакого текста вне JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    let raw = completion.choices[0]?.message?.content || "[]";

    // Убираем ```json и ```
    raw = raw.replace(/```json|```/g, "").trim();

    let questions;
    try {
      questions = JSON.parse(raw);
    } catch (e) {
      console.log("JSON не распарсился, пробуем вручную...");
      questions = fallbackParse(raw);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("ИИ не вернул вопросы");
    }

    res.json({
      success: true,
      topic,
      level,
      language: langNames[lang],
      totalQuestions: questions.length,
      questions: questions.slice(0, 10).map(q => ({
        question: q.question,
        options: q.options || [],
        correct: q.correct
      }))
    });

  } catch (err) {
    console.error("DeepSeek error:", err.message);
    res.status(500).json({
      error: "Не удалось сгенерировать тест",
      details: err.message
    });
  }
});

// Если ИИ сломал JSON — попробуем вытащить вопросы вручную
function fallbackParse(text) {
  const questions = [];
  const lines = text.split("\n");
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.match(/^\d+\./) || trimmed.includes("?")) && !trimmed.startsWith("A)")) {
      if (current) questions.push(current);
      current = { question: trimmed.replace(/^\d+\.\s*/, ""), options: [], correct: -1 };
    } else if (trimmed.match(/^[ABCD][\)\.]/)) {
      current.options.push(trimmed);
      if (trimmed.toLowerCase().includes("правильный") || trimmed.includes("to'g'ri")) {
        current.correct = current.options.length - 1;
      }
    }
  }
  if (current) questions.push(current);
  return questions;
}

module.exports = router;