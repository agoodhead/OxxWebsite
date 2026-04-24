import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../netlify/functions/chat.js";

test("chat function rejects non-post methods", async () => {
  const out = await handler({ httpMethod: "GET", body: "" });
  assert.equal(out.statusCode, 405);
});

test("chat function returns focused redirect for unrelated queries", async () => {
  const out = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ message: "What is the capital of France?", history: [] })
  });
  assert.equal(out.statusCode, 200);
  const body = JSON.parse(out.body);
  assert.match(body.reply, /Oxx-AI/i);
});
