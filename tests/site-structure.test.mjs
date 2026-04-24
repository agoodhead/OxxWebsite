import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("required static pages exist", async () => {
  const required = [
    "index.html",
    "examples/index.html",
    "faq/index.html",
    "downloads/index.html",
    "contact/index.html",
    "privacy/index.html",
    "terms/index.html",
    "disclaimer/index.html",
    "style.css",
    "script.js"
  ];

  for (const rel of required) {
    await fs.access(path.join(rootDir, rel));
  }
});

test("required assets and product docs exist", async () => {
  const required = [
    "assets/oxx-logo.png",
    "assets/andrew-goodhead.png",
    "assets/james-goodhead.png",
    "product_docs/product_overview.md",
    "product_docs/features.md",
    "product_docs/workflows.md",
    "product_docs/faq.md"
  ];
  for (const rel of required) {
    await fs.access(path.join(rootDir, rel));
  }
  assert.ok(true);
});
