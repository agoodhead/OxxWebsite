import { handler } from "../netlify/functions/chat.js";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required for smoke chat test.");
  process.exit(1);
}

const event = {
  httpMethod: "POST",
  body: JSON.stringify({
    message: "How does Oxx-AI help with report workflows?",
    history: []
  })
};

const out = await handler(event);
const body = JSON.parse(out.body || "{}");

if (out.statusCode !== 200 || !body.reply) {
  console.error("Smoke chat test failed.", out.statusCode, body.error || "");
  process.exit(1);
}

console.log("Smoke chat test passed.");
console.log(body.reply.slice(0, 240));
