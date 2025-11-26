const express = require("express");
const app = express();

// Роутеры
const { swaggerUi, swaggerSpec } = require("./config/swagger");
const videoRouter = require("./router/SearchVideo/SearchVideoRouter");
const bookRouter = require("./router/SearchBook/SearchBookRouter")
app.use(express.json()); // чтобы парсить JSON




app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/videos", videoRouter);
app.use("/books", bookRouter);





app.listen(3000, () => console.log("Server running on 3000"));
