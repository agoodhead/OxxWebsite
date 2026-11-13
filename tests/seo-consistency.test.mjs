import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const siteUrl = "https://oxx-ai.com";
// The hourly rate the site's time-saving example is based on (R1,500/hour).
const hourlyRate = 1500;

const read = (rel) => fs.readFile(path.join(rootDir, rel), "utf8");

const decode = (s) => s
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/&copy;/g, "©")
  .replace(/&amp;/g, "&");
const squash = (s) => decode(s).replace(/\s+/g, " ").trim();
const visibleText = (html) => squash(html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " "));
const meta = (html, attr, name) => {
  const value = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
  return value === undefined ? undefined : squash(value);
};
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]));
const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);

// Every page is index.html at the root or one folder down.
async function loadPages() {
  const pages = [{ url: `${siteUrl}/`, file: "index.html" }];
  for (const entry of await fs.readdir(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = `${entry.name}/index.html`;
    try {
      await fs.access(path.join(rootDir, file));
    } catch {
      continue;
    }
    pages.push({ url: `${siteUrl}/${entry.name}/`, file });
  }
  return Promise.all(pages.map(async (page) => ({ ...page, html: await read(page.file) })));
}

test("the separate consulting company is never named on the public site", async () => {
  const pages = await loadPages();
  const docs = (await fs.readdir(path.join(rootDir, "product_docs"))).map((name) => `product_docs/${name}`);
  const files = [...pages.map((page) => page.file), ...docs, "robots.txt", "sitemap.xml", "llms.txt", "script.js"];
  for (const rel of files) {
    assert.doesNotMatch(await read(rel), /oxx\s+consulting/i, `${rel} names the consulting company`);
  }
});

test("structured data blocks are valid JSON", async () => {
  for (const page of await loadPages()) {
    assert.doesNotThrow(() => jsonLd(page.html), `${page.file} has invalid JSON-LD`);
  }
});

test("FAQ structured data matches the visible FAQ word for word", async () => {
  const html = await read("faq/index.html");
  const visible = [...html.matchAll(/class="faq-q"[^>]*>([\s\S]*?)<\/button>\s*<div class="faq-a">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ q: squash(m[1]), a: visibleText(m[2]) }));
  const faq = jsonLd(html).find((doc) => doc["@type"] === "FAQPage");
  assert.ok(faq, "faq/index.html needs a FAQPage JSON-LD block");
  const structured = faq.mainEntity.map((entry) => ({ q: entry.name, a: entry.acceptedAnswer.text }));
  assert.deepEqual(structured, visible);
});

test("indexable pages have canonical and Open Graph tags and are in the sitemap", async () => {
  const pages = await loadPages();
  const sitemap = await read("sitemap.xml");
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const page of pages) {
    if (isNoindex(page.html)) {
      assert.ok(!listed.includes(page.url), `${page.file} is noindex but listed in sitemap.xml`);
      continue;
    }
    const title = squash(page.html.match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok(page.html.includes(`<link rel="canonical" href="${page.url}">`), `${page.file} needs canonical ${page.url}`);
    assert.equal(meta(page.html, "property", "og:url"), page.url, `${page.file} og:url`);
    assert.equal(meta(page.html, "property", "og:title"), title, `${page.file} og:title must match <title>`);
    assert.equal(meta(page.html, "property", "og:description"), meta(page.html, "name", "description"), `${page.file} og:description must match the meta description`);
    assert.ok(listed.includes(page.url), `${page.url} is missing from sitemap.xml`);
  }

  for (const url of listed) {
    assert.ok(pages.some((page) => page.url === url), `sitemap.xml lists ${url} but there is no such page`);
  }
  assert.match(await read("robots.txt"), /^Sitemap: https:\/\/oxx-ai\.com\/sitemap\.xml$/m);
});

test("indexable pages show no placeholder text", async () => {
  for (const page of await loadPages()) {
    if (isNoindex(page.html)) continue;
    assert.doesNotMatch(visibleText(page.html), /placeholder/i, `${page.file} shows placeholder text; finish it or mark it noindex`);
  }
});

test("prices in the structured data appear on the page, in llms.txt and in the product docs", async () => {
  const home = await read("index.html");
  const software = jsonLd(home)
    .flatMap((doc) => doc["@graph"] ?? [doc])
    .find((node) => node["@type"] === "SoftwareApplication");
  assert.ok(software, "index.html needs a SoftwareApplication JSON-LD node");

  // Prices are shown with the currency's symbol: "$20/month".
  const symbols = { USD: "$", ZAR: "R" };
  const currencies = [...new Set(software.offers.map((offer) => offer.priceCurrency))];
  assert.equal(currencies.length, 1, "all JSON-LD offers should be in one currency");
  const symbol = symbols[currencies[0]];
  assert.ok(symbol, `no price symbol known for ${currencies[0]}`);
  const escaped = symbol.replace(/[$]/g, "\\$");

  // Each priced card pairs with the paid offer of the same name. Cards with
  // no price (Free, Unlimited) don't count.
  const cardPattern = new RegExp(`<p class="pricing-tag">([^<]+)<\\/p>\\s*<h3>${escaped}([\\d,]+)\\/`, "g");
  const cards = [...home.matchAll(cardPattern)]
    .map((m) => ({ name: m[1], price: Number(m[2].replace(/,/g, "")) }));
  const paidOffers = software.offers
    .filter((offer) => Number(offer.price) > 0)
    .map((offer) => ({ name: offer.name, price: Number(offer.price) }));
  assert.deepEqual(paidOffers, cards, "JSON-LD offers must match the pricing cards (name and price)");

  const sources = {
    "index.html": visibleText(home),
    "faq/index.html": visibleText(await read("faq/index.html")),
    "llms.txt": await read("llms.txt"),
    "product_docs/product_overview.md": await read("product_docs/product_overview.md")
  };
  for (const offer of software.offers) {
    const price = Number(offer.price);
    if (price === 0) continue;
    const label = `${symbol}${price.toLocaleString("en-US")}`;
    for (const [rel, text] of Object.entries(sources)) {
      assert.ok(text.includes(label), `${rel} should mention the ${offer.name} price ${label}`);
    }
  }
});

test("time-saving figures agree everywhere", async () => {
  // The five per-stage savings, from the "Saving per workflow stage" line.
  const overview = await read("product_docs/product_overview.md");
  const stages = overview.match(/^Saving per workflow stage: (.*)$/m)?.[1];
  assert.ok(stages, "product_docs/product_overview.md needs its \"Saving per workflow stage:\" line");
  const stepMinutes = [...stages.matchAll(/(\d+) min\b/g)].map((m) => Number(m[1]));
  assert.equal(stepMinutes.length, 5, "each of the five workflow stages needs an \"N min\" time saving");

  const hours = stepMinutes.reduce((sum, minutes) => sum + minutes, 0) / 60;
  const rand = `R${(hours * hourlyRate).toLocaleString("en-US")}`;
  for (const rel of ["index.html", "faq/index.html", "llms.txt", "product_docs/product_overview.md", "product_docs/faq.md"]) {
    const text = await read(rel);
    assert.ok(text.includes(`about ${hours} hours`), `${rel} should say "about ${hours} hours" saved (the step savings add up to that)`);
    // The homepage gives the time saved but not the rand figure.
    if (rel === "index.html") continue;
    assert.ok(text.includes(rand), `${rel} should say ${rand} saved (${hours} hours at R${hourlyRate.toLocaleString("en-US")}/hour)`);
  }
});

test("llms.txt only links to files that exist", async () => {
  const llms = await read("llms.txt");
  const links = [...llms.matchAll(/\]\((https:\/\/oxx-ai\.com\/[^)]*)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 0);
  for (const url of links) {
    let rel = url.slice(siteUrl.length + 1);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    await fs.access(path.join(rootDir, rel));
  }
});
