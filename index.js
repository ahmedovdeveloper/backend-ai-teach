const express = require("express");
const cors = require("cors");
const path = require("path");


// config
const connectDB = require("./config/db")

const app = express();
connectDB("mongodb+srv://admin:admin@admiral.8xw5rol.mongodb.net/mars_hub?retryWrites=true&w=majority&appName=Admiral")

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
const videoPlayer = require("./router/Video/VideRouter");
const testRouter = require("./router/TestGenerate/TestGenerate")
const AuthRouter = require("./router/Auth/AuthRouter")
// Swagger документация
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Роутеры
app.use("/auth", AuthRouter)
app.use("/videos", videoRouter);
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
