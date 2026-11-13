# AI visibility plan for oxx-ai.com

Source: CapstonAI audit of oxx-ai.com, 29 October 2026. Plan written 2 November 2026.

Goal: when an engineer asks ChatGPT, Gemini, Claude or Perplexity for a tool to write inspection reports, Oxx Report is one of the 2-3 tools named in the answer.

## 1. Starting point

| Score | What it measures | Oxx | Weight |
|---|---|---|---|
| Overall LLM readiness | How ready the site is for AI assistants to understand, trust and quote it | 37 / 100 | |
| CRS, citation readiness | Does the site give an AI a reason to quote it: proof, sources, named experts, claims that agree with each other | 10 | 40 % |
| AFS, AI compatibility | Can an AI read the facts easily: structured data, llms.txt, clean text | 54 | 30 % |
| SRS, SEO readiness | Classic Google basics: titles, descriptions, speed, mobile, crawlability | 84 | 30 % |

| Category | What it checks | Score |
|---|---|---|
| Mobile and performance | Fast, works on phones | 100 % |
| Security and images | HTTPS, safe setup, image alt text and sizes | 88 % |
| On-page SEO | Titles, descriptions, headings | 86 % |
| Indexing and crawl | robots.txt, sitemap, canonical links | 78 % |
| E-E-A-T authority | Experience, Expertise, Authoritativeness, Trust: who is behind this, why believe them | 1 % |
| Entity optimization | Does an AI understand Oxx Report as a clear thing (software, by whom, where, for whom, at what price) | 4 % |
| Citation quality | Are claims backed by a stated method so an AI can safely repeat them | 27 % |
| AI accessibility | Can AI crawlers reach and digest the content | 46 % |

Question for CapstonAI: with the weights shown, 10 / 54 / 84 works out to about 45, not 37. Ask how the overall score is calculated.

The audit scores how the site is built. It has not yet measured whether AIs actually name Oxx Report today. That baseline is step 1 of Phase 4.

## 2. What was wrong on the site (2 Nov 2026)

1. No structured data (JSON-LD) on any page, so nothing told an AI in machine-readable form what Oxx Report is.
2. No robots.txt, sitemap.xml or llms.txt. No canonical links. Social sharing (Open Graph) tags only on the homepage.
3. Time-saving figures disagreed: homepage steps added up to about 5.5 hours saved, the homepage headline said about 3.5 hours, and the FAQ and chatbot docs said 2.5 hours. "R4,000 saved" matched none of them.
4. Placeholder text visible to the public: "Typical token usage placeholder" and "Coming soon final packaging" on the pricing cards, and placeholder privacy, terms and disclaimer pages.
5. A separate company name appeared in the homepage footer. Oxx Report is its own brand and that name must not appear anywhere on the site.
6. Founders named, but no credentials or external profiles.
7. Nothing on the homepage said where Oxx Report is based or that it is priced in rand.
8. The chatbot knowledge base (product_docs) had no pricing, so the chatbot could not answer "how much does it cost".

## 3. Phase 1: technical fixes (done on branch ai-visibility)

- [x] JSON-LD on the homepage: Organization, WebSite and SoftwareApplication with the three rand offers (free trial, R500/month, R1,000/report).
- [x] JSON-LD FAQPage on /faq/, mirroring every visible question word for word.
- [x] JSON-LD Person for both founders on /contact/.
- [x] robots.txt that explicitly welcomes the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others) and points to the sitemap.
- [x] sitemap.xml listing the five public pages.
- [x] llms.txt: a plain-text summary of Oxx Report for AI tools, linking to the product docs.
- [x] Canonical link and Open Graph tags on every public page.
- [x] Page language set to South African English (en-ZA).
- [x] Clearer page titles and descriptions that name the category ("AI-assisted inspection reports for engineers").
- [x] Internal files (notes, tests, tooling) blocked from the public site in netlify.toml.

## 4. Phase 2: make the claims believable

Done:
- [x] One set of time-saving numbers everywhere. Example at R1,500/hour: a standard report takes about 4.25 hours, with Oxx Report about 1.25 hours. That saves about 3 hours (R4,500) per report, about 70 % less time.
- [x] Homepage step savings now add up to the 3 hours: 15 + 15 + 30 + 90 + 30 minutes. **Check this split is realistic and adjust if needed (the total must stay 3 hours).**
- [x] Homepage shows the calculation behind the figures.
- [x] Placeholder wording removed from the pricing cards.
- [x] The separate company name removed from the footer; every footer now says "Cape Town, South Africa".
- [x] Placeholder legal pages hidden from search engines (noindex) until the real text is ready.
- [x] Pricing, free trial and location added to the chatbot knowledge base.

Needs you:
- [x] **Real legal text.** Privacy policy, terms of service and refund policy approved and live on 10 Nov 2026. Still open: the company registration number once registered, ideally a lawyer's review, and disclaimer text.
- [ ] **Evidence for the 3-hour figure.** Time a handful of real reports (old way vs Oxx Report), note the report types, and publish the results on an evidence page. Until then the site calls it an "example".
- [ ] **Founder credentials.** For each founder: qualifications, professional registration (for example ECSA), years of experience, and a LinkedIn link. Add them to /contact/ and to the Person JSON-LD (as sameAs links).
- [x] **Contact email domain.** Done 13 Nov 2026: the site now gives only support@oxx-ai.com (footers, Organization data, FAQ, product docs), as the live contact page already did. WhatsApp and andrew@oxx.co.za are gone.
- [ ] **Share image.** A 1200 x 630 image for link previews on LinkedIn and WhatsApp (og:image).
- [ ] **Capture types on the new homepage (10 Nov 2026).** The Inspect tile lists Image, Video, Voice, Conversation, Documents and Site Mapping, and says site information is "analysed". The structured data, llms.txt and product_docs only mention photos, voice notes, typed notes and documents. Confirm video, conversation and site mapping capture, then add them to the SoftwareApplication `featureList`, llms.txt and product_docs before the homepage goes live.
- [ ] **Inspect walkthrough photo (11 Nov 2026).** The right-hand Inspect tile uses a building-site photo (`assets/demo-image-site.webp`) with two example findings: "Rebar exposed for further construction." and "Handrail built: check for compliance." Confirm we have the rights to use the photo (it looks like a stock image) and that the findings show what Oxx Report really does with a photo. The tile then flips to a Voice example whose transcript, "Second storey shuttering inspection before concrete pour.", becomes the photo's caption: check that this is how voice notes and photos are linked in the app. Then it flips to Site Mapping (an aerial photo of a building site, `assets/demo-site-aerial.webp`, with a red route and photo and audio pins) and to Conversation (one recording split into Speaker 1, 2 and 3). Confirm the rights to the aerial photo too, and check that both steps match what the app does.
- [ ] **Review points (11 Nov 2026).** Beside the review graph the homepage now lists Review site details, Compliance checks and Reasoning analysis, then Human-in-the-loop accountability, Auditable decision making and Professional control. Confirm the app really does compliance checks before the homepage goes live, and say against what (for example SANS standards) if it does.
- [ ] **Review map example.** The Review tile's animated map uses a made-up case (courtyard crack, roof membrane). Check the wording, or swap in a real anonymised case. Since 12 Nov 2026 two cards open pictures from the Inspect walkthrough: "Site visit" opens the site map and "Roof defect photo" opens the analysed shuttering photo (rebar, handrail), which shows no roof defect. Rename that card, or let the graph follow the shuttering inspection.

## 5. Phase 3: answer the 10 buyer prompts

| # | Prompt | Where the site answers it | Status |
|---|---|---|---|
| 01 | How can engineers write inspection reports faster from site photos and voice notes? | New FAQ entry; homepage workflow | Done. Next: a longer guide page |
| 02 | Best AI tool to draft engineering site inspection reports | Homepage title and description, llms.txt, structured data | Done. Needs third-party listings (Phase 4) |
| 03 | How do I cut the time I spend on reports after a site inspection? | Homepage ROI section, FAQ ROI entry | Done |
| 04 | Opusense alternatives for small engineering consultancies | Comparison page | To do: needs verified competitor facts |
| 05 | Oxx Report vs Opusense for inspection reports | Comparison page | To do: needs verified competitor facts |
| 06 | InspectMind AI vs Oxx Report | Comparison page | To do: needs verified competitor facts |
| 07 | AI report-writing software for engineers in South Africa | New FAQ entry, footer location, rand prices in structured data, en-ZA | Done. Next: a dedicated South Africa page |
| 08 | Is an AI-drafted inspection report acceptable for a professional engineer? | FAQ: professional review and responsibility | Partly. Next: a page that cites the relevant ECSA guidance (you choose which) |
| 09 | How much does an AI inspection report tool cost per report? | New FAQ pricing entry, structured data offers | Done |
| 10 | Free AI tool to test on site inspection reports | New FAQ free-trial entry, structured data offer | Done |

Comparison pages must be factual and fair. Only state things about competitors that their own public pages confirm, and date them.

A redacted sample report on the How it works page would help both buyers and AIs. It needs a client's permission.

## 6. Phase 4: get mentioned elsewhere and measure

AI tools trust what other sites say about you more than what your own site says.

Off-site, in rough order of effort:
1. LinkedIn company page for Oxx Report, linked from the site. Founders post about real use cases.
2. Listings on G2, Capterra and Product Hunt.
3. South African engineering bodies and publications: SAICE, CESA, industry newsletters.
4. A client case study published on the client's own site or LinkedIn.

Measurement (monthly, about 30 minutes):
1. Run each of the 10 prompts on ChatGPT, Gemini, Claude and Perplexity, in a fresh chat with no history.
2. Record the results in a table like the one below.
3. Re-run the CapstonAI audit (or their free Chrome extension) to track the scores.

| Date | Prompt | Engine | Oxx named? | Tools named instead | Source the AI cited |
|---|---|---|---|---|---|
| | 01 | ChatGPT | | | |

## 7. Keeping it consistent

Every fact (prices, time saved, contact details, founders, FAQ answers) now appears in several places: the visible page, the structured data, llms.txt and the chatbot docs. CLAUDE.md in the repo root lists every place each fact lives. `npm test` fails if the FAQ structured data, prices, time-saving figures, canonical links or sitemap drift apart.

## 8. About CapstonAI's offer

Phases 1 to 3 are site changes that can be done in-house. The part worth paying for is the monthly measurement across four AI engines with a comparison against rivals, if you'd rather not run the prompts by hand.
