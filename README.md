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
2. Set key (PowerShell): `$env:OPENAI_API_KEY="YOUR_KEY"`
3. `npm start`
4. Open `http://localhost:3000`

## Deploy (GitHub -> Netlify)

1. Push this `site` folder to a GitHub repo.
2. Import that repo in Netlify.
3. Netlify reads `netlify.toml` automatically.
4. Set env var in Netlify:
   - `OPENAI_API_KEY`
   - Optional: `OPENAI_MODEL` (default is `gpt-4.1-mini`)

## Notes

- The chat assistant is intentionally product-only and grounded in `/product_docs/*.md`.
- For unrelated questions, the assistant politely declines and redirects to Oxx-AI topics.
