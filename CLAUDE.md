# CLAUDE.md

Static marketing site for Oxx Report at https://oxx-ai.com. Plain HTML, CSS and JS, deployed on Netlify with the repo root as the publish folder. The chat widget on /faq/ answers only from `product_docs/*.md`.

The site is tuned to be read and quoted by AI assistants (ChatGPT, Gemini, Claude, Perplexity). That only works if every fact says the same thing everywhere it appears. Most facts appear in four places: the visible page, the JSON-LD structured data in the page `<head>`, `llms.txt`, and `product_docs/`. When you change a fact, change all of them. Background and open items: `docs/ai-visibility-plan.md`.

Run `npm test` after every change. `tests/seo-consistency.test.mjs` catches most drift.

## Hard rules

- Never name Oxx Consulting or Oxx Consulting Engineers anywhere on the site, in `product_docs/`, `llms.txt` or structured data. Oxx Report is a separate business. (Tested.)
- The brand is **Oxx Report**. "Oxx-AI" appears only in the copyright line, the domain, and as `alternateName` in the Organization JSON-LD. The legal entity, OXX AI, is named only on the privacy and terms pages, as the operator.
- No placeholder text on an indexable page. An unfinished page gets `<meta name="robots" content="noindex">` and stays out of `sitemap.xml`. (Tested.)
- Don't invent numbers, credentials, client names or claims about competitors. Ask.
- Internal notes go in `docs/`. Anything at the repo root is public unless `netlify.toml` blocks it.

## Where each fact lives

| Fact | Current value | Update every one of these |
|---|---|---|
| Prices | R500/month + token usage about R100/report; R1,000/report pay as you use; three free reports, no card | `index.html`: pricing cards, `offers` in the SoftwareApplication JSON-LD, the ROI note ("against R1,000…"), the install prompt ("Three free reports"). `faq/index.html`: "How much does Oxx Report cost?" and "Is there a free trial?" (visible and JSON-LD). `llms.txt` key facts. `product_docs/product_overview.md` Pricing. `product_docs/faq.md`. |
| Time saved | Rate R1,500/hour; 4.25 h → 1.25 h; 3 h and R4,500 saved; about 70% less time; steps 15 + 15 + 30 + 90 + 30 min | `index.html`: the five step "Save N min." lines, the ROI summary (70%, "about 3 hours", "about R4,500", the ROI note). `faq/index.html`: "How does the ROI example work?" (visible and JSON-LD). `llms.txt`. `product_docs/product_overview.md` ROI Baseline and per-stage line. `product_docs/workflows.md` table (also R6,375 and R1,875). `product_docs/faq.md`. Keep the format "Save N min." on the steps: the test sums them. |
| Contact | andrew@oxx.co.za; WhatsApp +27 62 036 1649; Cape Town, South Africa | Footer on every page. `contact/index.html` Direct Contact and Andrew's Person JSON-LD. Organization JSON-LD in `index.html`. FAQ "How can Oxx Report be contacted?" (visible and JSON-LD). `llms.txt`. `product_docs/faq.md`. |
| Support email | support@oxx-ai.com, for privacy, contract and refund requests. The policy text gives only this email: no WhatsApp | Body of the privacy, terms and refunds pages. |
| Founders | James Goodhead and Andrew Goodhead, co-founders, bios on the contact page | `contact/index.html` team cards and Person JSON-LD. `founder` list in the Organization JSON-LD in `index.html`. `llms.txt`. |
| What it is, who it's for | AI-assisted reporting tool for engineers, inspectors and consultants; evidence-linked draft; professional reviews and approves | `index.html` meta and og descriptions and the SoftwareApplication `description` and `audience`. FAQ "What is Oxx Report?" and "Who is Oxx Report for?" (visible and JSON-LD). `llms.txt` summary. `product_docs/product_overview.md` and `product_docs/faq.md`. |
| Platform | Web app at https://report.oxx-ai.com/, installable; native Android and iOS apps planned; Microsoft Word integration | `downloads/index.html`. FAQ entries on apps and Word. SoftwareApplication `installUrl` and `featureList`. `llms.txt`. `product_docs/`. |
| Workflow steps | Inspect / Capture, Organise, Ground the Reasoning, Generate Report, Review / Refine | `index.html` steps. `examples/index.html`. FAQ "What is the workflow?". `llms.txt`. `product_docs/`. |
| Legal entity | OXX AI, 1 Albion Springs Cl, 41 Albion Place, Rondebosch, Western Cape, 7700, South Africa. Not registered yet: when it is, add "(Pty) Ltd" and the registration number | "Who we are" on `privacy/index.html` and `terms/index.html`. |
| Customer data | The app stores only what the user enters or uploads; customer content is never used to train AI models. The website runs no analytics and sets no cookies: the PostHog key in `script.js` is a placeholder, so PostHog never loads. If a real key goes in, the privacy policy must cover usage data and cookies again | `privacy/index.html` "What we collect", "How we use it" and "Cookies". `terms/index.html` "Your content". |

The tests do not check founders, contact details, platform or workflow names, the R1,000 in the ROI note, or the `workflows.md` cost columns. Check those by hand.

## Checklists

**Edit page content.** Set that page's `<lastmod>` in `sitemap.xml` to today.

**Change a page title or meta description.** Make `og:title` match `<title>` and `og:description` match the meta description. (Tested.)

**Add, change or remove a FAQ entry.**
1. Edit the visible item in `faq/index.html`.
2. Make the same edit in the FAQPage JSON-LD in that file's `<head>`: same order, same wording. (Tested.)
3. Mirror it in `product_docs/faq.md` so the chatbot knows it.
4. If it states a fact from the table above, update the other places too.

**Add a page.**
1. Copy the `<head>` of an existing page: `lang="en-ZA"`, title "Page | Oxx Report", meta description, canonical, and the `og:*` tags (`og:url` is the canonical URL).
2. Use the same header, nav and footer as the other pages. The footer contact column ends with "Cape Town, South Africa".
3. Add it to `sitemap.xml`, to the Pages list in `llms.txt`, and to the required list in `tests/site-structure.test.mjs`.

**Legal pages.** Privacy, terms and refunds went live on 10 Nov 2026 (commit ac58fbe on `main`, with `main`'s header and footer). Merge `main` into a branch before committing work that touches them; an untracked `refunds/` folder blocks that merge until it is moved aside. The refund policy says pay as you use is charged for the tokens used: the founders chose that wording, so ask before changing it. The disclaimer is still a placeholder; to publish it, remove the noindex tag and add it to `sitemap.xml` and the Pages list in `llms.txt`. The privacy policy must cover POPIA. The terms link to the pricing section and don't repeat the prices, so prices only need updating in the places listed above.

**Founder credentials or LinkedIn profiles arrive.** Add them to the contact cards, and add a `sameAs` list of profile URLs to each Person JSON-LD. Add a company LinkedIn page as `sameAs` on the Organization in `index.html`.

**New competitor or comparison content.** Only state facts the competitor's own public pages confirm, and date them.

## Commands

- `npm start`: local server at http://localhost:3000 (the chat needs `OPENROUTER_API_KEY`).
- `npm test`: structure, chat and consistency tests.
