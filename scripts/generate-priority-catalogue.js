#!/usr/bin/env node

/**
 * Generate public/priority-catalogue.json: every visible package in "Most Popular"
 * order, holding just the card data, so the default view can render before
 * Ballerina Central answers (see src/lib/priority-catalogue).
 *
 * Runs from generate-sitemap.js on the packages it already downloaded, so there is
 * no second fetch. It only READS public/ranking-data.json (never writes it). The
 * output is gitignored and a failed run leaves no file behind: the app then behaves
 * exactly as it does without a snapshot.
 *
 * By hand: npm run generate-priority
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'priority-catalogue.json');
const RANKING_PATH = path.join(PUBLIC_DIR, 'ranking-data.json');

// Same hide lists as the app (src/lib/connector-utils HIDDEN_PACKAGES).
function loadHiddenPackages() {
  return new Set([
    ...require('../src/lib/connector-utils/hidden-packages.json'),
    ...require('../src/lib/connector-utils/deprecated-packages.json'),
  ]);
}

// Same rule as isHiddenPackage in src/lib/connector-utils: bare name or "org/name".
function isHidden(pkg, hidden) {
  return (
    hidden.has(pkg.name) || (!!pkg.organization && hidden.has(`${pkg.organization}/${pkg.name}`))
  );
}

// Same identity the app derives in rest-client.ts (extractConnectorIdentity).
function connectorKey(pkg) {
  const pathname = new URL(pkg.URL, 'https://central.ballerina.io').pathname;
  const parts = pathname
    .replace(/^\/?packages\//, '')
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return `ballerinax/${pkg.name}`;
}

// Same score as "Most Popular" in rest-client.ts (sortMergedPackages, pullCount-desc).
function rateScore(pkg, ranking) {
  const entry = ranking[connectorKey(pkg)];
  if (!entry || entry.ratePerDay === null || entry.ratePerDay === undefined) return 0;
  return Math.log10(entry.ratePerDay + 1);
}

function toCard(pkg) {
  return {
    name: pkg.name,
    organization: pkg.organization,
    version: pkg.version,
    URL: pkg.URL,
    summary: pkg.summary,
    keywords: pkg.keywords,
    icon: pkg.icon,
    createdDate: pkg.createdDate,
    totalPullCount: pkg.pullCount,
  };
}

function validate(page) {
  if (page.packages.length === 0) {
    throw new Error('priority-catalogue: no visible packages');
  }
  page.packages.forEach((pkg, i) => {
    for (const field of ['name', 'version', 'URL']) {
      if (typeof pkg[field] !== 'string' || pkg[field] === '') {
        throw new Error(`priority-catalogue: package #${i} (${pkg.name}) is missing ${field}`);
      }
    }
    // Central sends createdDate as epoch milliseconds (a number); kept verbatim.
    const dateOk =
      (typeof pkg.createdDate === 'string' && pkg.createdDate !== '') ||
      Number.isFinite(pkg.createdDate);
    if (!dateOk) {
      throw new Error(`priority-catalogue: package #${i} (${pkg.name}) is missing createdDate`);
    }
    if (typeof pkg.summary !== 'string' || typeof pkg.icon !== 'string') {
      throw new Error(`priority-catalogue: package #${i} (${pkg.name}) is missing summary or icon`);
    }
    if (!Array.isArray(pkg.keywords)) {
      throw new Error(`priority-catalogue: package #${i} (${pkg.name}) is missing keywords`);
    }
  });
}

/**
 * Pure: what searchPackages({ sort: 'pullCount-desc' }) lists across all pages --
 * de-duplicate by name+version first, then hide, then stable-sort by rate score.
 * Ties keep input order, as in the app.
 */
function buildPriorityCatalogue({
  packages,
  ranking,
  hidden,
  generatedAt = new Date().toISOString(),
}) {
  // Same order as fetchCatalog in rest-client.ts: a hidden duplicate still shadows.
  const seen = new Set();
  const visible = [];
  for (const pkg of packages) {
    const id = `${pkg.name}-${pkg.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (isHidden(pkg, hidden)) continue;
    visible.push(pkg);
  }

  const scored = visible.map((pkg) => ({ pkg, score: rateScore(pkg, ranking) }));
  scored.sort((a, b) => b.score - a.score);

  const page = {
    generatedAt,
    totalCount: scored.length,
    packages: scored.map(({ pkg }) => toCard(pkg)),
  };
  validate(page);
  return page;
}

/** Removes any previous output so a failed run can never leave a stale file. */
function clearPriorityCatalogue(outPath = OUTPUT_PATH) {
  try {
    fs.rmSync(outPath, { force: true });
  } catch (error) {
    console.warn(`priority-catalogue: could not remove ${outPath}: ${error.message}`);
  }
}

/**
 * Builds and writes the file. Never throws: returns false (and writes nothing) when
 * the ranking data or the packages are unusable.
 */
function writePriorityCatalogue(packages, options = {}) {
  const outPath = options.outPath || OUTPUT_PATH;
  const rankingPath = options.rankingPath || RANKING_PATH;
  try {
    const ranking = JSON.parse(fs.readFileSync(rankingPath, 'utf8')).packages;
    if (!ranking || typeof ranking !== 'object' || Object.keys(ranking).length === 0) {
      throw new Error(`no ranking entries in ${rankingPath}`);
    }
    const hidden = options.hidden || loadHiddenPackages();
    const page = buildPriorityCatalogue({ packages, ranking, hidden });

    const tmpPath = `${outPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(page), 'utf8');
    fs.renameSync(tmpPath, outPath);
    console.log(`✓ Priority catalogue written: ${page.totalCount} packages -> ${outPath}`);
    return true;
  } catch (error) {
    console.warn(`priority-catalogue: not generated (${error.message}); the app runs without it.`);
    return false;
  }
}

async function main() {
  clearPriorityCatalogue();
  try {
    // Lazy: generate-sitemap requires this module, so a top-level require would cycle.
    const { fetchAllPackages } = require('./generate-sitemap');
    writePriorityCatalogue(await fetchAllPackages());
  } catch (error) {
    console.warn(`priority-catalogue: not generated (${error.message}); the app runs without it.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildPriorityCatalogue, clearPriorityCatalogue, writePriorityCatalogue };
