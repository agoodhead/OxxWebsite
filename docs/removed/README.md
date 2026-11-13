# Removed sections

Sections taken off the site but kept to review later. Each entry says what the section was, where its markup is saved, what was left in place so it can come back, and what else changed when it went. `docs/` is not public (`netlify.toml` returns 404 for `/docs/*`).

## Workflow Comparison (homepage)

Removed 13 Nov 2026, on request, to review again later.

**Where it was.** `index.html`, between How it works and Pricing: `<section id="workflow" aria-label="Oxx Report workflow comparison">`. No menu link pointed to it.

**Saved markup.** [workflow-comparison.html](workflow-comparison.html), copied verbatim from the page.

**What it showed.** Heading "Why use OXX for Professional Reports?" with the eyebrow "Workflow Comparison" and the intro "Each stage shows what changes in the reporting workflow…". Then five steps, each on its own full-width band (white, green, white, green, white). Each step had a Traditional vs Oxx table, Time, Quality and Risk notes, and a video with sound that played on hover.

| Step | Table heading | Time saved | Video | Poster |
|---|---|---|---|---|
| 1 Inspect and Capture | While on site | 15 min | `inspect-hover-video` | `workflow-inspect-capture.webp` |
| 2 Organise | Organising data | 15 min | `organise-hover-video` | `workflow-organise.webp` |
| 3 Ground the Reasoning | Technical grounding | 30 min | `ground-reasoning-hover-video` | `workflow-ground-reasoning.webp` |
| 4 Generate Report | Drafting the report | 90 min | `generate-report-hover-video` | `workflow-generate-report.webp` |
| 5 Review and Refine | Professional review | 30 min | `review-refine-hover-video` | `workflow-review-refine.webp` |

Videos are in `assets/` as `.webm` and `.mp4`. The posters are still used on `examples/index.html`.

**Left in place, so it can come back as it was.**
- CSS in `style.css`: `.v2-sketch-*`, `.stage-roi`, `.roi-metric`, `.roi-symbol`, `.v2-audio-note`.
- JS in `script.js`: the `[data-hover-video]` handler (does nothing while the section is gone).
- The ten video files. `tests/site-structure.test.mjs` still requires the `.mp4` files and the posters, so they don't get deleted by accident.

**What else changed when it went.**
- The homepage's background bands were flipped so green and white still alternate: Pricing is now white, Downloads green, and the closing call to action white.
- The "Save N min." lines were the only place on the homepage with the per-stage time savings. The time-saving test in `tests/seo-consistency.test.mjs` now reads them from the "Saving per workflow stage" line in `product_docs/product_overview.md`. The figures themselves (15 + 15 + 30 + 90 + 30 min, 3 hours, R4,500) are unchanged everywhere else.
- `CLAUDE.md`: the Time saved and Workflow steps rows no longer list `index.html` steps.

**To restore.**
1. Paste the saved markup back into `index.html` after the How it works band (`</div>` closing `#how-it-works`) and before the Pricing band.
2. Re-alternate the bands below it: the steps keep their own (white first), then Pricing green, Downloads white, closing call to action green.
3. Optionally point the time-saving test back at the homepage's "Save N min." lines.
