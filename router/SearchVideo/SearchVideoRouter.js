const express = require("express");
const router = express.Router();

// Dynamic import for fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Supported languages
const LANG_MAP = {
  ru: { code: "ru", name: "Russian", ytLang: "ru", franc: "rus" },
  en: { code: "en", name: "English", ytLang: "en", franc: "eng" },
  uz: { code: "uz", name: "Uzbek", ytLang: "uz", franc: "uzb" },
};

// Language detection
function detectLanguage(text, targetLang) {
  if (!text) return false;
  const lower = text.toLowerCase();

  const dict = {
    ru: ["урок", "курс", "обучение", "объясняю", "полный курс", "с нуля", "для начинающих", "математика", "программирование"],
    en: ["course", "tutorial", "lesson", "beginner", "full course", "learn", "how to", "complete guide"],
    uz: ["dars", "kurs", "o'zbekcha", "darslik", "boshlang'ich", "to'liq kurs", "o'rganish"],
  };

  if (dict[targetLang].some(word => lower.includes(word))) return true;

  try {
    const { franc } = require("franc");
    const detected = franc(text, { minLength: 10, whitelist: ["rus", "eng", "uzb"] });
    if (detected === LANG_MAP[targetLang].franc) return true;
  } catch (e) {}

  if (targetLang === "uz" && /o['’]zbek|tili|uzb/.test(lower)) return true;
  if (targetLang === "ru" && /русский|российский|русскоязычный/.test(lower)) return true;
  if (targetLang === "en" && /english|subtitle|eng/.test(lower)) return true;

  return false;
}

/**
 * @openapi
 * /videos/search-course:
 *   get:
 *     summary: Search educational courses on YouTube
 *     description: Returns top 5 YouTube playlists filtered by topic, level and language.
 *     tags:
 *       - Videos
 *     parameters:
 *       - in: query
 *         name: theme
 *         required: true
 *         description: "Course topic. Example: matematika, python, english"
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         required: false
 *         description: "Difficulty level: beginner, intermediate, advanced"
 *         schema:
 *           type: string
 *           default: beginner
 *       - in: query
 *         name: lang
 *         required: false
 *         description: "Language filter: ru, en, uz"
 *         schema:
 *           type: string
 *           default: ru
 */
router.get("/search-course", async (req, res) => {
  const topic = req.query.theme?.trim();   // <-- FIXED HERE
  const level = req.query.level || "beginner";
  const lang = req.query.lang || "ru";

  if (!topic)
    return res.status(400).json({ error: "Query parameter 'theme' is required" });

  const API_KEY =
    process.env.GOOGLE_CLOUD_KEY || "AIzaSyC0mm3lT3wZYhzT8CSrhHlC-zOJsM5IqcU";

  const langConfig = LANG_MAP[lang] || LANG_MAP.ru;

  try {
    const searchQuery = `${topic} ${
      level === "beginner"
        ? "с нуля"
        : level === "intermediate"
        ? "средний уровень"
        : "продвинутый"
    } курс`;

    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}` +
      `&type=playlist&maxResults=10&regionCode=${langConfig.code.toUpperCase()}` +
      `&relevanceLanguage=${langConfig.ytLang}&key=${API_KEY}`;

    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();

    if (searchData.error) {
      return res.status(500).json({
        error: "YouTube API error",
        details: searchData.error,
      });
    }

    const courses = [];

    for (const item of searchData.items || []) {
      const playlistId = item.id?.playlistId;
      if (!playlistId) continue;

      const playlistUrl =
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}` +
        `&maxResults=50&key=${API_KEY}`;

      const plResp = await fetch(playlistUrl);
      const plData = await plResp.json();

      if (!Array.isArray(plData.items)) continue;

      const validVideos = plData.items
        .filter(v => detectLanguage(`${v.snippet.title} ${v.snippet.description}`, lang))
        .slice(0, 30)
        .map(v => ({
          title: v.snippet.title,
          videoId: v.snippet.resourceId.videoId,
          videoUrl: `https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`,
          thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url,
        }));

      if (validVideos.length >= 5) {
        courses.push({
          title: item.snippet.title,
          description: item.snippet.description,
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.high?.url,
          totalVideos: validVideos.length,
          videos: validVideos,
          playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          language: langConfig.name,
        });
      }
    }

    courses.sort((a, b) => b.totalVideos - a.totalVideos);

    res.json({
      topic,
      level,
      language: langConfig.name,
      totalCourses: courses.length,
      courses: courses.slice(0, 5),
    });
  } catch (err) {
    console.error("YouTube search error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
