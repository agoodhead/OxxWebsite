import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler as chatHandler } from "./netlify/functions/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/chat", async (req, res) => {
  const event = {
    httpMethod: "POST",
    body: JSON.stringify(req.body || {})
  };
  const out = await chatHandler(event);
  res.status(out.statusCode).set(out.headers || {}).send(out.body);
});

app.listen(port, () => {
  console.log(`Local server: http://localhost:${port}`);
});
