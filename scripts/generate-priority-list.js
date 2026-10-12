#!/usr/bin/env node

/**
 * Generate priority-list.json for the Integration Store.
 *
 * The store used to fetch the whole Ballerina Central catalog in the browser
 * (about 840 packages, two 500-package requests that take 10-30 s) just to rank
 * it, drop hidden/deprecated packages and slice out the first page. This script
 * does that work once, at build time:
 *
 *   1. fetch every package from Central,
 *   2. drop hidden and deprecated packages (the same lists the app uses),
 *   3. order what is left by the download-rate ranking in ranking-data.json,
 *   4. write the result, with the card data the store renders, to
 *      public/priority-list.json.
 *
 * At runtime the store reads that one static file for unfiltered views, so it
 * needs no Central call to render the first page. Packages released after the
 * build are picked up live (see rest-client.ts).
 *
 * Copies of the hidden and deprecated lists are committed next to it in public/
 * (hidden-packages.json, deprecated-packages.json) so other tools can read them. They are
 * not generated here; a test keeps them identical to the sources the app imports.
 *
 * The list drives what the store renders, so an incomplete one is worse than none: if
 * Central can't be reached, or doesn't return every package it reports, this exits with
 * an error and fails the build instead of shipping a partial list. For a build that
 * can't reach Central on purpose (offline, a quick local check), set
 * SKIP_PRIORITY_LIST=true: no list is generated and the store falls back to querying
 * Central directly.
 *
 * Output shape:
 *   { generatedAt, centralCount, total, packages: [ { organization, name, version,
 *     URL, summary, keywords, icon, createdDate, pullCount, ratePerDay }, ... ] }
 * `packages` is in default "Most Popular" order.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'priority-list.json');
const RANKING_PATH = path.join(PUBLIC_DIR, 'ranking-data.json');
const HIDDEN_SRC = path.join(ROOT, 'src', 'lib', 'connector-utils', 'hidden-packages.json');
const DEPRECATED_SRC = path.join(ROOT, 'src', 'lib', 'connector-utils', 'deprecated-packages.json');

const { fetchAllPackages } = require('./lib/central');

// A catalog smaller than this means Central answered badly; don't publish it.
const MIN_PACKAGES = 100;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Same rule as isHiddenPackage in connector-utils.ts: an entry is a bare package
 * name (every org) or "org/name" (that org only).
 */
function makeIsHidden(entries) {
  const hidden = new Set(entries);
  return (pkg) =>
    hidden.has(pkg.name) || (!!pkg.organization && hidden.has(`${pkg.organization}/${pkg.name}`));
}

/** Same score as getRateScore in rest-client.ts: log-scaled rate, 0 when unranked. */
function rateScore(ratePerDay) {
  return typeof ratePerDay === 'number' ? Math.log10(ratePerDay + 1) : 0;
}

function toEntry(pkg, ranking) {
  const rate = ranking[`${pkg.organization}/${pkg.name}`]?.ratePerDay;
  return {
    organization: pkg.organization,
    name: pkg.name,
    version: pkg.version,
    URL: pkg.URL,
    summary: pkg.summary,
    keywords: pkg.keywords || [],
    icon: pkg.icon,
    createdDate: pkg.createdDate,
    pullCount: pkg.pullCount,
    ratePerDay: typeof rate === 'number' ? Math.round(rate * 1000) / 1000 : null,
  };
}

function buildPriorityList(packages, hiddenEntries, ranking) {
  const isHidden = makeIsHidden(hiddenEntries);
  return packages
    .filter((pkg) => !isHidden(pkg))
    .map((pkg) => toEntry(pkg, ranking))
    .sort((a, b) => rateScore(b.ratePerDay) - rateScore(a.ratePerDay));
}

async function main() {
  const hiddenEntries = [...readJson(HIDDEN_SRC, []), ...readJson(DEPRECATED_SRC, [])];
  const ranking = readJson(RANKING_PATH, {}).packages || {};
  if (Object.keys(ranking).length === 0) {
    console.warn('ranking-data.json is missing or empty: the list will be unranked.');
  }

  // Throws unless every package Central reports came back.
  const { count, packages } = await fetchAllPackages({ sort: 'pullCount,DESC' });
  if (packages.length < MIN_PACKAGES) {
    throw new Error(
      `only ${packages.length} packages came back; expected at least ${MIN_PACKAGES}`
    );
  }

  const list = buildPriorityList(packages, hiddenEntries, ranking);
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      centralCount: count,
      total: list.length,
      packages: list,
    }) + '\n'
  );
  console.log(
    `Wrote ${list.length} packages to ${OUTPUT_PATH} (${count} in Central, ${count - list.length} hidden or deprecated)`
  );
}

if (require.main === module) {
  if (process.env.SKIP_PRIORITY_LIST === 'true') {
    console.warn('SKIP_PRIORITY_LIST=true: not generating priority-list.json.');
  } else {
    main().catch((error) => {
      console.error(`Could not generate priority-list.json: ${error.message}`);
      console.error(
        'Fix the cause and rebuild, or set SKIP_PRIORITY_LIST=true to build without it.'
      );
      process.exit(1);
    });
  }
}

module.exports = { buildPriorityList, makeIsHidden, rateScore };
