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
    "refunds/index.html",
    "disclaimer/index.html",
    "style.css",
    "script.js",
    "review-graph.js",
    "review-graph.css"
  ];

  for (const rel of required) {
    await fs.access(path.join(rootDir, rel));
  }
});

test("required assets and product docs exist", async () => {
  const required = [
    "assets/oxx-logo-transparent.webp",
    "assets/oxx-report-logo-wide.webp",
    "assets/inspect-site-visit-square.mp4",
    "assets/capture-image.webp",
    "assets/capture-video.webp",
    "assets/capture-voice.webp",
    "assets/capture-conversation.webp",
    "assets/capture-documents.webp",
    "assets/vendor/react-18.3.1.production.min.js",
    "assets/vendor/react-dom-18.3.1.production.min.js",
    "assets/vendor/xyflow-react-12.12.0.umd.js",
    "assets/vendor/xyflow-react-12.12.0.css",
    "assets/oxx-favicon-32.png",
    "assets/oxx-favicon.ico",
    "assets/oxx-apple-touch-icon.png",
    "assets/andrew-goodhead.webp",
    "assets/james-goodhead.webp",
    "assets/workflow-inspect-capture.webp",
    "assets/workflow-organise.webp",
    "assets/workflow-ground-reasoning.webp",
    "assets/workflow-generate-report.webp",
    "assets/workflow-review-refine.webp",
    "assets/inspect-hover-video.mp4",
    "assets/organise-hover-video.mp4",
    "assets/ground-reasoning-hover-video.mp4",
    "assets/generate-report-hover-video.mp4",
    "assets/review-refine-hover-video.mp4",
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
