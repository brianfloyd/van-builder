#!/usr/bin/env tsx
// Scrapes a product page for the specs the van-builder catalog cares about
// (dimensions, weight, price) and either prints them for review or, with
// --commit, adds them straight to the live catalog via the SAME
// projectOps.ts functions the app and the MCP server use.
//
// Why this exists: WebFetch only sees a page's initial server-rendered HTML.
// Amazon (and plenty of other retailers) load their actual spec table via
// client-side JS after that — WebFetch reliably gets the <title>/meta tags
// and nothing else for those listings. This script drives a real (headless)
// Chromium via Playwright, waits for the page to finish rendering, and reads
// the spec table out of the live DOM instead.
//
// Usage:
//   npx tsx scripts/scrape-product.ts <url>                     # dry run, prints what it found
//   npx tsx scripts/scrape-product.ts <url> --commit             # also adds it to the catalog
//   npx tsx scripts/scrape-product.ts <url> --commit --name "..." --category appliance
//
// Always adds with status "placeholder" regardless of --commit — scraped
// text is parsed with regexes against messy, inconsistent retailer markup;
// treat every result as a draft to eyeball (or hand to Claude to eyeball)
// before flipping it to "final" in the Catalog panel.
//
// A note on scope/etiquette: this drives a real browser at whatever URL you
// give it, on your own machine, for occasional personal lookups while
// planning a build — the same thing you'd do by hand in a browser tab, just
// with the spec-table copy-paste automated. It is not built for, and
// shouldn't be used for, bulk/automated scraping of a retailer's catalog —
// that's a different scale of thing and most sites' terms of service (Amazon
// included) don't allow it. Some listings will still block headless
// browsers outright (CAPTCHA / "automated access" interstitials); when that
// happens this prints what it saw and you copy the numbers by hand, same as
// today.

import { chromium } from 'playwright';
import { addDef, normalizeProject } from '../src/projectOps';
import { DEFAULT_DEFS, DEFAULT_SHELL, buildDefaultOverlapMatrix } from '../src/defaultData';
import { CATEGORIES } from '../src/types';
import type { Category } from '../src/types';
import { readProject, writeProject } from '../mcp-server/projectFile';

interface ScrapeResult {
  url: string;
  title: string | null;
  priceText: string | null;
  priceUsd: number | null;
  weightText: string | null;
  weightLb: number | null;
  dimsText: string | null;
  dims: { w: number; d: number; h: number } | null;
  dimsAxisMappingConfident: boolean;
  rawSpecs: Record<string, string>;
  warnings: string[];
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// NOTE: these run as raw strings via page.evaluate(string), not as function
// references — tsx/esbuild wraps compiled functions with a `__name(...)`
// helper for debug naming, and Playwright serializes function *arguments* by
// stringifying them, so that wrapper call ends up shipped into the page
// context where `__name` doesn't exist and throws a ReferenceError. A plain
// source string sidesteps the wrapping entirely.

const CLEAN_HELPER = `const clean = (s) => (s ?? '').replace(/\\s+/g, ' ').trim();`;

/** Amazon renders its spec table in one of several different DOM shapes
 * depending on category/listing age — try each known one and merge whatever
 * matches. Falls through harmlessly (empty result) on non-Amazon pages. */
async function extractAmazonSpecs(page: import('playwright').Page): Promise<Record<string, string>> {
  return page.evaluate(`(() => {
    const specs = {};
    ${CLEAN_HELPER}

    // Classic "Product information" table (id varies by category).
    document
      .querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr')
      .forEach((row) => {
        const label = clean(row.querySelector('th')?.textContent);
        const value = clean(row.querySelector('td')?.textContent);
        if (label && value) specs[label] = value;
      });

    // Newer "Product overview" mini-table.
    document.querySelectorAll('#poExpander tr, #productOverview_feature_div table tr').forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const label = clean(cells[0].textContent);
        const value = clean(cells[1].textContent);
        if (label && value) specs[label] = value;
      }
    });

    // Bullet-style detail list ("Item Weight  ‣  87 pounds").
    document.querySelectorAll('#detailBulletsWrapper_feature_div li, #detailBullets_feature_div li').forEach((li) => {
      const text = clean(li.textContent);
      const m = text.match(/^([A-Za-z][A-Za-z0-9 /()'".-]{2,60}?)\\s*[:‏‏]\\s*(.+)$/);
      if (m) specs[m[1].trim()] = m[2].trim();
    });

    return specs;
  })()`) as Promise<Record<string, string>>;
}

/** Targeted price lookup for Amazon's buybox — a body-wide "$NN" regex is
 * unreliable (warranty upsells, unrelated recommended-item prices, review
 * mentions of cost all match). These selectors are, in priority order, the
 * actual current-price element across old and new Amazon layouts. */
async function extractAmazonPrice(page: import('playwright').Page): Promise<string | null> {
  return page.evaluate(`(() => {
    const selectors = [
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price:not(.a-text-price) .a-offscreen',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el && el.textContent ? el.textContent.trim() : '';
      if (text) return text;
    }
    return null;
  })()`) as Promise<string | null>;
}

/** Generic fallback for non-Amazon pages: pulls every <table> row, every
 * <dl> term/definition pair, and any bullet list item that looks like
 * "Label: Value" or "Label — Value" text, anywhere on the page. Noisier
 * than the Amazon-specific pass but works on arbitrary manufacturer/retailer
 * spec pages without per-site tuning. */
async function extractGenericSpecs(page: import('playwright').Page): Promise<Record<string, string>> {
  return page.evaluate(`(() => {
    const specs = {};
    ${CLEAN_HELPER}

    document.querySelectorAll('table tr').forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length === 2) {
        const label = clean(cells[0].textContent);
        const value = clean(cells[1].textContent);
        if (label && value && label.length < 60 && value.length < 200) specs[label] = value;
      }
    });

    document.querySelectorAll('dl').forEach((dl) => {
      const terms = Array.from(dl.querySelectorAll('dt'));
      const defs = Array.from(dl.querySelectorAll('dd'));
      terms.forEach((dt, i) => {
        const label = clean(dt.textContent);
        const value = clean(defs[i]?.textContent);
        if (label && value) specs[label] = value;
      });
    });

    document.querySelectorAll('li, p').forEach((el) => {
      const text = clean(el.textContent);
      if (text.length > 150) return; // prose paragraph, not a spec line
      const m = text.match(/^([A-Za-z][A-Za-z0-9 /()'".-]{2,50}?)\\s*[:–—-]\\s*(.+)$/);
      if (m && !specs[m[1].trim()]) specs[m[1].trim()] = m[2].trim();
    });

    return specs;
  })()`) as Promise<Record<string, string>>;
}

/** Matches "17.95"D x 19.69"W x 32.68"H" in any axis order (the common
 * spec-sheet style) — returns w/d/h correctly assigned regardless of the
 * order the letters appear in, since that varies by listing. */
function parseLabeledDims(text: string): { w: number; d: number; h: number } | null {
  const re = /(\d+(?:\.\d+)?)\s*"?\s*([DWH])/gi;
  const found: Partial<Record<'D' | 'W' | 'H', number>> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const axis = m[2].toUpperCase() as 'D' | 'W' | 'H';
    found[axis] = parseFloat(m[1]);
  }
  if (found.D != null && found.W != null && found.H != null) {
    return { w: found.W, d: found.D, h: found.H };
  }
  return null;
}

/** Fallback for unlabeled "12 x 8 x 6 inches" — order is ambiguous (could be
 * L x W x H, W x D x H, anything), so this is only used when no labeled
 * match exists, and the caller is told to treat the axis mapping as
 * unconfirmed. */
function parseBareDims(text: string): { w: number; d: number; h: number } | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:in(?:ches)?|")?\s*x\s*(\d+(?:\.\d+)?)\s*(?:in(?:ches)?|")?\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return { w: parseFloat(m[1]), d: parseFloat(m[2]), h: parseFloat(m[3]) };
}

function findDims(specs: Record<string, string>, bodyText: string): { dimsText: string | null; dims: ScrapeResult['dims']; confident: boolean } {
  const dimKeys = Object.keys(specs).filter((k) => /dimension|size/i.test(k));
  for (const k of dimKeys) {
    const labeled = parseLabeledDims(specs[k]);
    if (labeled) return { dimsText: specs[k], dims: labeled, confident: true };
  }
  for (const k of dimKeys) {
    const bare = parseBareDims(specs[k]);
    if (bare) return { dimsText: specs[k], dims: bare, confident: false };
  }
  const labeledInBody = parseLabeledDims(bodyText);
  if (labeledInBody) return { dimsText: null, dims: labeledInBody, confident: true };
  return { dimsText: null, dims: null, confident: false };
}

function findWeight(specs: Record<string, string>): { text: string | null; lb: number | null } {
  const key = Object.keys(specs).find((k) => /weight/i.test(k) && !/shipping/i.test(k));
  const text = key ? specs[key] : null;
  if (!text) return { text: null, lb: null };
  const m = text.match(/(\d+(?:\.\d+)?)\s*(pounds?|lbs?)\b/i);
  if (m) return { text, lb: parseFloat(m[1]) };
  const kg = text.match(/(\d+(?:\.\d+)?)\s*(kilograms?|kg)\b/i);
  if (kg) return { text, lb: Math.round(parseFloat(kg[1]) * 2.20462 * 100) / 100 };
  return { text, lb: null };
}

async function scrape(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true });
  const warnings: string[] = [];
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1400, height: 1600 }, locale: 'en-US' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500).catch(() => {});

    // Amazon frequently shows a one-click "Continue shopping" soft
    // interstitial to unrecognized traffic before the real page — not a
    // real CAPTCHA, just an extra click. Click through it if present.
    const continueBtn = page
      .getByRole('button', { name: /continue shopping/i })
      .or(page.getByRole('link', { name: /continue shopping/i }));
    if ((await continueBtn.count().catch(() => 0)) > 0) {
      await continueBtn.first().click().catch(() => {});
      await page.waitForTimeout(2000).catch(() => {});
    }

    // Give client-rendered spec tables a moment to hydrate.
    await page.waitForTimeout(1500).catch(() => {});

    const title = await page.title().catch(() => null);
    const bodyText = ((await page.evaluate('document.body.innerText').catch(() => '')) as string) ?? '';

    if (/enter the characters you see|type the characters|captcha|automated access to amazon data/i.test(bodyText)) {
      warnings.push('Page looks like a bot-check/CAPTCHA interstitial the click-through didn\'t clear — the site blocked this request. No specs extracted.');
    }

    const amazonSpecs = url.includes('amazon.') ? await extractAmazonSpecs(page) : {};
    const genericSpecs = await extractGenericSpecs(page);
    const rawSpecs = { ...genericSpecs, ...amazonSpecs }; // prefer Amazon-specific parse where both matched

    if (Object.keys(rawSpecs).length === 0) {
      warnings.push('No structured label:value spec pairs found on the page — it may need scrolling/interaction to load, or specs live in a product-image infographic (not scrapeable as text).');
    }

    let priceText = url.includes('amazon.') ? await extractAmazonPrice(page).catch(() => null) : null;
    if (!priceText) {
      const priceMatch = bodyText.match(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);
      priceText = priceMatch ? priceMatch[0] : null;
      if (priceText) warnings.push(`Price "${priceText}" came from a page-wide text scan, not a price element — LOW CONFIDENCE, it may be an unrelated dollar amount on the page. Verify before trusting it.`);
    }
    const { dimsText, dims, confident } = findDims(rawSpecs, bodyText);
    const { text: weightText, lb: weightLb } = findWeight(rawSpecs);

    if (dims && !confident) {
      warnings.push(
        `Dimensions found as "${dimsText}" with no D/W/H letters — order is a guess (assumed first=W, second=D, third=H). VERIFY before trusting this.`
      );
    }
    if (!dims) warnings.push('Could not find a parseable dimensions field. Check rawSpecs below for a differently-worded field, or read it off the page yourself.');
    if (weightText && weightLb == null) warnings.push(`Found a weight field ("${weightText}") but couldn't parse a number out of it.`);

    const priceNumMatch = priceText?.match(/(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);

    return {
      url,
      title,
      priceText,
      priceUsd: priceNumMatch ? parseFloat(priceNumMatch[1].replace(/,/g, '')) : null,
      weightText,
      weightLb,
      dimsText,
      dims,
      dimsAxisMappingConfident: confident,
      rawSpecs,
      warnings,
    };
  } finally {
    await browser.close();
  }
}

function guessCategory(title: string): Category {
  const t = title.toLowerCase();
  const hits: [RegExp, Category][] = [
    [/fridge|refrigerator|freezer|cooler/, 'appliance'],
    [/air condition|\bac\b|a\/c\b/, 'appliance'],
    [/heater/, 'appliance'],
    [/toilet/, 'toilet'],
    [/shower/, 'shower'],
    [/sink|faucet/, 'sink'],
    [/battery|inverter|charger|fuse|breaker|shunt/, 'electrical'],
    [/solar panel/, 'roof'],
    [/vent|fan/, 'roof'],
    [/water tank|water heater|water pump|water filter/, 'water'],
    [/bed|mattress/, 'bed'],
    [/cabinet/, 'cabinet'],
    [/light/, 'lighting'],
  ];
  for (const [re, cat] of hits) if (re.test(t)) return cat;
  return 'other';
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  const commit = args.includes('--commit');
  const nameFlagIdx = args.indexOf('--name');
  const nameOverride = nameFlagIdx >= 0 ? args[nameFlagIdx + 1] : null;
  const categoryFlagIdx = args.indexOf('--category');
  const categoryOverride = categoryFlagIdx >= 0 ? (args[categoryFlagIdx + 1] as Category) : null;

  if (!url) {
    console.error('Usage: npx tsx scripts/scrape-product.ts <url> [--commit] [--name "..."] [--category appliance]');
    process.exit(1);
  }
  if (categoryOverride && !CATEGORIES.includes(categoryOverride)) {
    console.error(`--category must be one of: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  console.log(`Scraping ${url} ...`);
  const result = await scrape(url);

  console.log('\n=== Scrape result ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.warnings.length > 0) {
    console.log('\n=== Warnings ===');
    result.warnings.forEach((w) => console.log('  ⚠ ' + w));
  }

  if (!commit) {
    console.log('\n(dry run — pass --commit to add this to the catalog as a "placeholder" def)');
    return;
  }

  if (!result.dims) {
    console.error('\nRefusing to --commit: no usable dimensions were extracted. Re-run without --commit, fill in dims by hand, and use add_def/the Catalog panel directly instead.');
    process.exit(1);
  }

  const project = readProject();
  const { project: next, id } = addDef(project, {
    name: nameOverride ?? result.title ?? url,
    category: categoryOverride ?? guessCategory(result.title ?? ''),
    dims: result.dims,
    estCost: result.priceUsd ?? undefined,
    status: 'placeholder',
    notes:
      `Scraped from ${url}.` +
      (result.dimsAxisMappingConfident ? '' : ' Dimension axis order (W/D/H) is UNCONFIRMED — verify before trusting.') +
      (result.weightLb != null ? ` Weight: ${result.weightLb} lb.` : '') +
      (result.warnings.length ? ' Warnings: ' + result.warnings.join(' ') : ''),
  });
  writeProject(next);
  const def = next.defs.find((d) => d.id === id)!;
  console.log('\n=== Added to catalog (status: placeholder — review before marking final) ===');
  console.log(JSON.stringify(def, null, 2));
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
