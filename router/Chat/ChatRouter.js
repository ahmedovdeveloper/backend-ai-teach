// routes/chat.js — ПРОСТОЙ ЧАТ БЕЗ АВТОРИЗАЦИИ И ЛИМИТОВ
const express = require("express");
const router = express.Router();

const OPENROUTER_API_URL = process.env.LLM_API_URL || "https://openrouter.ai/api/v1/chat/completions"; // 
const OPENROUTER_KEY = process.env.OPENAI_API_KEY || "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"; // твой ключ от OpenRouter

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Простой чат с ИИ — пиши что угодно, получай ответ
 *
 * /api/chat:
 *   post:
 *     summary: Отправить сообщение ИИ и получить ответ
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Твоё сообщение для ИИ
 *                 example: "Привет! Расскажи анекдот"
 *               model:
 *                 type: string
 *                 description: Модель ИИ (по умолчанию gpt-4o-mini)
 *                 example: "gpt-4o-mini"
 *                 default: "gpt-4o-mini"
 *     responses:
 *       200:
 *         description: Успешный ответ от ИИ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 reply:
 *                   type: string
 *                   description: Ответ от ИИ
 *                   example: "Привет! Почему программисты не любят природу? Потому что там полно багов! 🐛"
 *                 model_used:
 *                   type: string
 *                   example: "gpt-4o-mini"
 *       400:
 *         description: Сообщение не указано
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Сообщение обязательно"
 *       500:
 *         description: Ошибка сервера или ИИ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */

router.post("/chat", async (req, res) => {
  try {
    const { message, model = "gpt-4o-mini" } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Сообщение обязательно" });
    }

    // Запрос к OpenRouter
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "http://localhost:5173", // можно изменить на свой домен
        "X-Title": "AHA AI",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Ты дружелюбный, полезный и остроумный помощник. Отвечай кратко, по делу и с юмором, когда это уместно.",
          },
          { role: "user", content: message },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Ошибка ИИ" });
    }

    const reply = data.choices?.[0]?.message?.content?.trim() || "Нет ответа от ИИ";

    res.json({
      success: true,
      reply,
      model_used: model,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

module.exports = router;