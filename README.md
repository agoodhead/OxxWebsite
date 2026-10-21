# Oxx-AI Static Marketing Website

Static HTML/CSS/JS website with Netlify-ready serverless chat.

## Structure

- `/index.html`
- `/examples/index.html`
- `/faq/index.html`
- `/downloads/index.html`
- `/contact/index.html`
- `/privacy/index.html`
- `/terms/index.html`
- `/disclaimer/index.html`
- `/style.css`
- `/script.js`
- `/assets/*`
- `/product_docs/*.md`
- `/netlify/functions/chat.js`

## Local run

1. `npm install`
2. Set key (PowerShell): `$env:OPENROUTER_API_KEY="YOUR_KEY"`
3. `npm start`
4. Open `http://localhost:3000`

## Deploy (GitHub -> Netlify)

1. Push this `site` folder to a GitHub repo.
2. Import that repo in Netlify.
3. Netlify reads `netlify.toml` automatically.
4. Set env var in Netlify:
   - `OPENROUTER_API_KEY`
   - Optional: `OPENROUTER_MODEL` (default is `deepseek/deepseek-v4.1-flash`)

## Notes

- The chat assistant calls the model through OpenRouter, is intentionally product-only, and is grounded in `/product_docs/*.md`.
- Images in `/assets` are WebP files sized for how they display on the page; keep new images under a few hundred KB.
- `/assets/*` is cached by browsers for a year (see `netlify.toml`). When replacing an image or video, save it under a new filename and update the reference, otherwise returning visitors keep the old file.
- For unrelated questions, the assistant politely declines and redirects to Oxx-AI topics.
- PostHog tracking is wired in `/script.js`; set `POSTHOG_PROJECT_API_KEY` there with your project key (`phc_...`).
