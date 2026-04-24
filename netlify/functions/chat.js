import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const docsDir = path.resolve(process.cwd(), "product_docs");
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

function isClearlyUnrelated(message) {
  const q = message.toLowerCase();
  const unrelatedPatterns = [
    /capital of/,
    /weather in/,
    /stock price/,
    /crypto price/,
    /write (a )?python/,
    /write (a )?javascript/,
    /solve .* equation/,
    /recipe for/,
    /sports score/,
    /translate .* to/
  ];
  return unrelatedPatterns.some((pattern) => pattern.test(q));
}

function scoreSnippet(snippet, query) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const hay = snippet.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

function topKSnippets(docText, query, k = 5) {
  const sections = docText
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);

  return sections
    .map((text) => ({ text, score: scoreSnippet(text, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.text);
}

async function loadKnowledge() {
  try {
    const entries = await fs.readdir(docsDir, { withFileTypes: true });
    const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
    const docs = [];
    for (const file of mdFiles) {
      const fullPath = path.join(docsDir, file.name);
      const text = await fs.readFile(fullPath, "utf8");
      docs.push({ name: file.name, text });
    }
    return docs;
  } catch {
    return [];
  }
}

function strictSystemPrompt(knowledge) {
  return `You are the Oxx-AI Product Assistant.

You only answer questions about Oxx-AI, its features, workflows, use cases, platform availability, onboarding, contact, and legal/disclaimer information.

If a question is unrelated:
- Politely decline.
- Redirect to Oxx-AI product help.

If a feature is not supported:
- Do not just say "no".
- Explain the limitation clearly.
- Suggest the closest supported capability.

Tone:
- Professional
- Trust-focused
- Concise

Never:
- Invent capabilities
- Answer general knowledge questions
- Give coding help or unrelated advice

Use only the knowledge context provided below.

Knowledge:
${knowledge}`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON body." })
    };
  }

  const message = payload.message?.trim();
  const history = Array.isArray(payload.history) ? payload.history : [];
  if (!message) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Message is required." })
    };
  }

  if (isClearlyUnrelated(message)) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply:
          "I am here to help with Oxx-AI only. I can explain features, workflows, supported platforms, downloads, and booking a demo."
      })
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "OPENAI_API_KEY is not configured." })
    };
  }

  try {
    const docs = await loadKnowledge();
    const retrieved = docs
      .flatMap((d) => topKSnippets(d.text, message, 2).map((snippet) => `[${d.name}] ${snippet}`))
      .slice(0, 8)
      .join("\n\n");

    const system = strictSystemPrompt(retrieved || "No knowledge files were loaded.");
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        ...history.slice(-8),
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "No response generated.";
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || "Chat failed." })
    };
  }
}
