// routes/videos/search-course.js
const express = require("express");
const router = express.Router();

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Языки и их настройки (regionCode — проверенные и рабочие!)
const LANG_MAP = {
  ru: { name: "Русский", region: "RU", relevance: "ru" },
  en: { name: "English", region: "US", relevance: "en" },
  uz: { name: "O'zbekcha", region: "UZ", relevance: "uz" },
};

// Простая детекция языка по ключевым словам
function isCorrectLanguage(text = "", lang) {
  const lower = text.toLowerCase();
  const keywords = {
    ru: ["урок", "курс", "обучение", "с нуля", "русский", "российский"],
    en: ["tutorial", "course", "lesson", "beginner", "learn", "how to"],
    uz: ["dars", "kurs", "o'zbekcha", "darslik", "to'liq", "boshlang'ich"],
  };
  return keywords[lang]?.some(kw => lower.includes(kw)) ?? false;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * @swagger
 * /videos/search-course:
 *   get:
 *     summary: Поиск образовательных курсов на YouTube
 *     description: >
 *       Возвращает до 5 лучших плейлистов-курсов по теме, уровню и языку.
 *       Поддерживает русский, английский и узбекский языки.
 *     tags:
 *       - Videos
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Тема курса (например, `python`, `математика`, `ingliz tili`)
 *         example: python
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           default: beginner
 *         description: Уровень сложности
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [ru, en, uz]
 *           default: ru
 *         description: Язык курса
 *     responses:
 *       200:
 *         description: Успешный ответ с курсами
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 topic:
 *                   type: string
 *                 level:
 *                   type: string
 *                 language:
 *                   type: string
 *                   example: "Русский"
 *                 totalCourses:
 *                   type: integer
 *                   example: 4
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         example: "Python с нуля — Полный курс 2025"
 *                       description:
 *                         type: string
 *                       channel:
 *                         type: string
 *                         example: "Веб-стандарты"
 *                       thumbnail:
 *                         type: string
 *                         format: uri
 *                       totalVideos:
 *                         type: integer
 *                         example: 28
 *                       playlistUrl:
 *                         type: string
 *                         format: uri
 *                         example: "https://www.youtube.com/playlist?list=PL..."
 *                       language:
 *                         type: string
 *                       videos:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             videoId:
 *                               type: string
 *                             url:
 *                               type: string
 *                               format: uri
 *                             thumbnail:
 *                               type: string
 *                               format: uri
 *       400:
 *         description: Не указана тема (q или theme)
 *       429:
 *         description: Превышен лимит YouTube API
 *       502:
 *         description: YouTube API недоступен
 *       504:
 *         description: Таймаут запроса к YouTube
 */

router.get("/search-course", async (req, res) => {
  try {
    const topic = (req.query.q || "").toString().trim();
    const level = (req.query.level || "beginner").toLowerCase();
    const lang = (req.query.lang || "ru").toLowerCase();

    if (!topic) {
      return res.status(400).json({
        error: "Параметр 'q' или 'theme' обязателен",
        example: "/videos/search-course?q=python&lang=ru",
      });
    }

    const API_KEY = process.env.GOOGLE_CLOUD_KEY || "AIzaSyC0mm3lT3wZYhzT8CSrhHlC-zOJsM5IqcU";
    const config = LANG_MAP[lang] || LANG_MAP.ru;

    const levelSuffix =
      level.includes("beginner") ? "с нуля" :
      level.includes("intermediate") ? "средний" :
      level.includes("advanced") ? "продвинутый" : "с нуля";

    const query = `${topic} ${levelSuffix} курс`.trim();

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.append("part", "snippet");
    searchUrl.searchParams.append("q", query);
    searchUrl.searchParams.append("type", "playlist");
    searchUrl.searchParams.append("maxResults", "8");
    searchUrl.searchParams.append("regionCode", config.region);
    searchUrl.searchParams.append("relevanceLanguage", config.relevance);
    searchUrl.searchParams.append("key", API_KEY);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({
        error: "YouTube API недоступен",
        youtubeError: err.error || response.statusText,
      });
    }

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 403) {
        return res.status(429).json({ error: "Превышен лимит YouTube API (quota exceeded)" });
      }
      return res.status(500).json({ error: "YouTube API error", details: data.error });
    }

    if (!data.items || data.items.length === 0) {
      return res.json({
        success: true,
        topic,
        level,
        language: config.name,
        totalCourses: 0,
        courses: [],
      });
    }

    const courses = [];

    for (const item of data.items) {
      const playlistId = item.id?.playlistId;
      if (!playlistId) continue;

      try {
        const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`;
        const plRes = await fetch(plUrl);
        const plData = await plRes.json();

        if (!Array.isArray(plData.items)) continue;

        const validVideos = plData.items
          .filter(v => isCorrectLanguage(`${v.snippet.title} ${v.snippet.description || ""}`, lang))
          .slice(0, 30)
          .map(v => ({
            title: v.snippet.title,
            videoId: v.snippet.resourceId.videoId,
            url: `https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`,
            thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url || "",
          }));

        if (validVideos.length >= 4) {
          courses.push({
            title: item.snippet.title,
            description: item.snippet.description || "",
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.high?.url || "",
            totalVideos: validVideos.length,
            videos: validVideos,
            playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
            language: config.name,
          });
        }

        await delay(250); // Анти-бан
      } catch (e) {
        console.log("Ошибка при загрузке плейлиста:", playlistId, e.message);
      }
    }

    courses.sort((a, b) => b.totalVideos - a.totalVideos);

    res.json({
      success: true,
      topic,
      level,
      language: config.name,
      totalCourses: courses.length,
      courses: courses.slice(0, 5),
    });

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Таймаут запроса к YouTube" });
    }
    console.error("search-course error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

module.exports = router;