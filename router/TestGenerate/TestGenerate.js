const express = require("express");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

/* =========================================================
   ФУНКЦИЯ ПЕРЕВОДА ОДНОГО ТЕКСТА
========================================================= */
async function translateText(text, targetLang) {
  if (!text || targetLang === "en") return text;

  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: targetLang,
        format: "text",
      }),
    });

    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.error("Translate error:", error);
    return text;
  }
}

/* =========================================================
   ФУНКЦИЯ ПЕРЕВОДА ВСЕЙ СТРУКТУРЫ ВОПРОСА
========================================================= */
async function translateQuestion(questionObj, lang) {
  return {
    ...questionObj,
    question: await translateText(questionObj.question, lang),
    correct_answer: await translateText(questionObj.correct_answer, lang),
    incorrect_answers: await Promise.all(
      questionObj.incorrect_answers.map((answer) =>
        translateText(answer, lang)
      )
    ),
  };
}

/* =========================================================
   SWAGGER
========================================================= */
/**
 * @swagger
 * /test/tests:
 *   get:
 *     summary: Получить тесты по предмету, уровню и языку
 *     parameters:
 *       - in: query
 *         name: subject
 *         required: true
 *         schema:
 *           type: string
 *           example: it
 *
 *       - in: query
 *         name: level
 *         required: true
 *         schema:
 *           type: string
 *           example: beginner
 *
 *       - in: query
 *         name: amount
 *         required: false
 *         schema:
 *           type: number
 *           example: 10
 *
 *       - in: query
 *         name: lang
 *         required: false
 *         schema:
 *           type: string
 *           example: ru
 *
 *     responses:
 *       200:
 *         description: Список тестов
 */

/* =========================================================
   ОСНОВНОЙ РОУТ
========================================================= */

async function translateText(text, targetLang) {
  if (!text || targetLang === "en") return text;

  // Защита от HTML-сущностей (opentdb их использует: &quot; → ")
  const decodedText = text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: decodedText,
        source: "en",
        target: targetLang,
        format: "text",
      }),
      timeout: 5000,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.translatedText || decodedText;
  } catch (error) {
    console.error("Translation failed for:", decodedText.substring(0, 50), error.message);
    return decodedText; // возвращаем оригинал при ошибке
  }
}


module.exports = router