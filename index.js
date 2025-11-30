const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Разрешаем CORS для фронтенда на порту 8082
app.use(cors({
  origin: "http://localhost:8082",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Парсинг JSON
app.use(express.json());

// Подключаем роутеры
const { swaggerUi, swaggerSpec } = require("./config/swagger");
const videoRouter = require("./router/SearchVideo/SearchVideoRouter");
const bookRouter = require("./router/SearchBook/SearchBookRouter");
const chatRouter = require("./router/ChatGpt/ChatGrok");
const videoPlayer = require("./router/Video/VideRouter");
const testRouter = require("./router/TestGenerate/TestGenerate")
// Swagger документация
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Роутеры
app.use("/videos", videoRouter);
app.use("/chat", chatRouter);
app.use("/books", bookRouter);
app.use("/video", videoPlayer);
app.use("/test", testRouter);

// Статические файлы: видео
// Важно: путь до видео учитывает, что папка temp-video лежит в router/
app.use(
  "/temp-video",
  express.static(path.join(__dirname, "router", "temp-video"))
);

// Статические файлы фронтенда (если React / HTML)
app.use(express.static(path.join(__dirname, "frontend")));

// Запуск сервера
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
