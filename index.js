const express = require("express");
const cors = require("cors"); // <-- добавляем
const app = express();

// Разрешаем CORS для фронтенда на порту 8082
app.use(cors({
  origin: "http://localhost:8082", // фронтенд
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Роутеры
const { swaggerUi, swaggerSpec } = require("./config/swagger");
const videoRouter = require("./router/SearchVideo/SearchVideoRouter");
const bookRouter = require("./router/SearchBook/SearchBookRouter");
const chatRouter = require("./router/ChatGpt/ChatGrok");

app.use(express.json()); // парсинг JSON

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/videos", videoRouter);
app.use("/chat", chatRouter);
app.use("/books", bookRouter);

app.listen(3000, () => console.log("Server running on 3000"));
