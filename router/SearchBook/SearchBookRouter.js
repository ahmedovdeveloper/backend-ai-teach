const express = require("express");
const router = express.Router();
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Кеш
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 час

// Языковые настройки
const LANG_CONFIG = {
  ru: { ytLang: "ru", querySuffix: " уроки pdf скачать бесплатно", sites: "site:ru site:su" },
  en: { ytLang: "en", querySuffix: " lessons pdf free download", sites: "site:edu site:org filetype:pdf" },
  uz: { ytLang: "uz", querySuffix: " darslik pdf bepul yuklab olish", sites: "site:uz filetype:pdf" },
};

// Улучшенная функция детекции языка (с иконками и ключевыми словами)
function detectLanguage(text, targetLang) {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Словарный фильтр (ключевые слова)
  const keywords = {
    ru: ["урок", "курс", "обучение", "pdf скачать", "бесплатно"],
    en: ["lesson", "tutorial", "course", "pdf download", "free"],
    uz: ["dars", "kurs", "o'rganish", "pdf yuklab", "bepul"],
  };

  if (keywords[targetLang].some(word => lower.includes(word))) return true;

  // Franc как fallback
  try {
    const franc = require("franc");
    const detected = franc(text, { minLength: 10 });
    return detected === (targetLang === "ru" ? "rus" : targetLang === "en" ? "eng" : "uzb");
  } catch (e) {}

  return false;
}

// Новые источники для PDF
const SOURCES = [
  // 1. Google Scholar + Edu Sites (лучший для уроков)
  {
    name: "Google Scholar",
    search: (q, lang) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q + " tutorial OR lesson OR course filetype:pdf")}&hl=${lang}&as_sdt=0,5`,
    parse: async (html) => {
      const results = [];
      const regex = /<a href="(https?:\/\/[^"]+\.pdf[^"]*)"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) && results.length < 5) {
        const url = match[1];
        if (url.includes("scholar") || !detectLanguage(match[2], lang)) continue;
        results.push({
          title: match[2].trim(),
          source: "Google Scholar",
          url,
          format: "PDF",
          direct: true,
        });
      }
      return results;
    },
  },

  // 2. OpenStax (бесплатные учебники, английские)
  {
    name: "OpenStax",
    search: (q, lang) => `https://openstax.org/search?q=${encodeURIComponent(q)}`,
    parse: async (html) => {
      const results = [];
      const regex = /<a href="(https:\/\/openstax.org\/books\/[^"]+\/pages\/[^"]*\.pdf[^"]*)"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) && results.length < 3) {
        results.push({
          title: match[2].trim(),
          source: "OpenStax",
          url: match[1],
          format: "PDF",
          direct: true,
        });
      }
      return results;
    },
  },

  // 3. MIT OpenCourseWare (бесплатные курсы, английские)
  {
    name: "MIT OCW",
  search: (q, lang) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(q)}&submit=Search`,
    parse: async (html) => {
      const results = [];
      const regex = /<a href="(https:\/\/ocw\.mit\.edu\/[^"]*\.pdf[^"]*)"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) && results.length < 3) {
        results.push({
          title: match[2].trim(),
          source: "MIT OCW",
          url: match[1],
          format: "PDF",
          direct: true,
        });
      }
      return results;
    },
  },

  // 4. PDF Drive (улучшенный парсер)
  {
    name: "PDF Drive",
    search: (q, lang) => `https://www.pdfdrive.com/search?q=${encodeURIComponent(q + " tutorial OR lesson OR course")}&pagecount=&pubyear=&searchin=&em=`,
    parse: async (html) => {
      const results = [];
      const regex = /<a href="(\/[^"]+\.html)"[^>]+title="([^"]+)"[^>]*data-cfasync="false">/g;
      let match;
      while ((match = regex.exec(html)) && results.length < 8) {
        const title = match[2].replace("Download PDF", "").trim();
        if (title.length < 5 || !detectLanguage(title, lang)) continue;
        results.push({
          title,
          source: "PDF Drive",
          url: `https://www.pdfdrive.com${match[1]}`,
          format: "PDF",
        });
      }
      return results;
    },
  },

  // 5. GitHub (репозитории с PDF)
  {
    name: "GitHub",
    search: (q, lang) => `https://api.github.com/search/code?q=${encodeURIComponent(q + " filetype:pdf")}&per_page=10`,
    parse: async (json) => {
      const results = [];
      if (json.items) {
        for (const item of json.items.slice(0, 5)) {
          results.push({
            title: item.name.replace('.pdf', ''),
            source: "GitHub",
            url: item.html_url,
            format: "PDF",
            direct: item.download_url || false,
          });
        }
      }
      return results;
    },
  },
];

// GET /books/search?q=python уроки&lang=ru
router.get("/search", async (req, res) => {
  let { q: query, lang = "ru" } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: "Параметр q обязателен и минимум 2 символа" });
  }

  query = query.trim();

  const cacheKey = `${lang}:${query.toLowerCase()}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }
  }

  const langCfg = LANG_CONFIG[lang] || LANG_CONFIG.ru;

  try {
    const allResults = [];

    // Параллельный поиск
    const promises = SOURCES.map(async (source) => {
      try {
        const url = source.search(query, lang);
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) return [];

        const data = source.name === "GitHub" ? await response.json() : await response.text();
        return await source.parse(data);
      } catch (err) {
        console.log(`Ошибка в ${source.name}:`, err.message);
        return [];
      }
    });

    const resultsArray = await Promise.all(promises);
    resultsArray.forEach(arr => allResults.push(...arr));

    // Убираем дубли и фильтруем
    const seen = new Set();
    const unique = allResults.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return detectLanguage(item.title, lang);
    });

    // Сортируем по релевантности
    const sorted = unique
      .sort((a, b) => {
        if (a.direct && !b.direct) return -1;
        if (!a.direct && b.direct) return 1;
        return b.totalVideos - a.totalVideos || a.title.localeCompare(b.title);
      })
      .slice(0, 15); // топ-15

    const result = {
      query,
      language: lang,
      totalFound: sorted.length,
      sources: SOURCES.map(s => s.name),
      books: sorted,
    };

    cache.set(cacheKey, { data: result, time: Date.now() });
    res.json(result);

  } catch (err) {
    console.error("Search books error:", err);
    res.status(500).json({ error: "Ошибка поиска", details: err.message });
  }
});

module.exports = router;