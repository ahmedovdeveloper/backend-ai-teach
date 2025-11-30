// router/Video/VideoPlayerRouter.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const { v4: uuidv4 } = require("uuid");

const TEMP_DIR = path.join(__dirname, "../temp-video");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// --- Вспомогательная функция для очистки старых видео ---
function cleanOldVideos() {
  const files = fs.readdirSync(TEMP_DIR);
  files.forEach(file => {
    const filePath = path.join(TEMP_DIR, file);
    const stats = fs.statSync(filePath);
    // удаляем файлы старше 10 минут
    if (Date.now() - stats.mtimeMs > 10 * 60 * 1000) {
      fs.unlinkSync(filePath);
    }
  });
}

// --- POST /video/play ---
/**
 * @swagger
 * /video/play:
 *   post:
 *     summary: Скачать YouTube-видео и получить прямую MP4-ссылку
 *     tags: [Video Player]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://www.youtube.com/watch?v=I54WaZpa810"
 *     responses:
 *       200:
 *         description: Видео скачано успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 videoUrl:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.post("/play", async (req, res) => {
  const { url } = req.body;
  if (!url || (!url.includes("youtube") && !url.includes("youtu.be"))) {
    return res.status(400).json({ error: "Пришли ссылку на YouTube" });
  }

  try {
    cleanOldVideos(); // чистим старые видео

    const match = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
    if (!match) return res.status(400).json({ error: "Не распознал YouTube-видео" });

    const videoId = match[1];
    const uniqueFilename = `${videoId}-${uuidv4()}.mp4`;
    const filePath = path.join(TEMP_DIR, uniqueFilename);

    console.log("Скачиваю видео:", videoId);
// hello
    // yt-dlp для скачивания видео
    await execPromise(
      `yt-dlp -f "best[height<=720][ext=mp4]/best[ext=mp4]" --no-playlist -o "${filePath}" --user-agent "Mozilla/5.0" "${url}"`,
      { timeout: 120000, maxBuffer: 1024 * 1024 * 100 } // 2 минуты, 100 МБ буфера
    );

    if (!fs.existsSync(filePath)) {
      throw new Error("Видео не было создано");
    }

    const fileSize = fs.statSync(filePath).size;
    const directUrl = `http://localhost:3000/temp-video/${uniqueFilename}`;

    res.json({
      success: true,
      videoUrl: directUrl,
      fileSize: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
      message: "Видео скачано и готово к просмотру!"
    });

  } catch (err) {
    console.error("yt-dlp ошибка:", err.message);
    res.status(500).json({
      error: "Не удалось скачать видео",
      details: err.message,
      hint: "Проверь установку yt-dlp: yt-dlp --version"
    });
  }
});

// --- Раздача скачанных видео ---
router.use("/temp-video", express.static(TEMP_DIR));

module.exports = router;
