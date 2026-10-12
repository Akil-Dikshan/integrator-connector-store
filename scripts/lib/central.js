/**
 * Shared Ballerina Central helpers for the build-time scripts (ranking data and priority
 * list), so the retry and batching logic lives in one place.
 */

const SEARCH_ENDPOINT = 'https://api.central.ballerina.io/2.0/registry/search-packages';
const ALL_PACKAGES_QUERY = 'org:(ballerina OR ballerinax)';

/** GET a URL as JSON, retrying with exponential backoff (500 ms, 1 s, 2 s...). */
async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i));
    }
  }
  throw new Error(`${url}: ${lastError.message}`);
}

/**
 * Fetches every ballerina and ballerinax package from Central.
 *
 * The first request also tells us the total, so the remaining batches go out in parallel.
 * Paging by offset over a sort with ties (many packages share a pull count) can repeat a
 * package at a batch boundary and drop another, so the result is de-duplicated by
 * `org/name` and checked against Central's own total. A short result is fetched again
 * (up to `attempts` times) and then rejected, so callers never work from a silently
 * incomplete catalog.
 *
 * Options: `batchSize` (default 500, Central's maximum), `sort` (e.g. 'pullCount,DESC'),
 * `readme` (default false: the scripts never need the README text), `attempts` (default 3).
 * Resolves `{ count, packages }`, where `count` is Central's own total.
 */
async function fetchAllPackages({ batchSize = 500, sort, readme = false, attempts = 3 } = {}) {
  // Built by hand: Central answers HTTP 500 if the comma in `sort` is percent-encoded.
  const urlFor = (offset) =>
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(ALL_PACKAGES_QUERY)}&offset=${offset}` +
    `&limit=${batchSize}&readme=${readme}${sort ? `&sort=${sort}` : ''}`;

  let unique = [];
  let count = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const first = await fetchJson(urlFor(0));
    const offsets = [];
    for (let offset = batchSize; offset < first.count; offset += batchSize) offsets.push(offset);
    const rest = await Promise.all(offsets.map((offset) => fetchJson(urlFor(offset))));

    const byKey = new Map();
    [first, ...rest]
      .flatMap((page) => page.packages || [])
      .forEach((pkg) => byKey.set(`${pkg.organization}/${pkg.name}`, pkg));
    unique = [...byKey.values()];
    count = first.count;

    if (unique.length >= count) return { count, packages: unique };
    console.warn(
      `Central returned ${unique.length} distinct packages for a total of ${count} ` +
        `(attempt ${attempt} of ${attempts})`
    );
  }
  throw new Error(`Central returned only ${unique.length} of ${count} packages`);
}

module.exports = { SEARCH_ENDPOINT, fetchJson, fetchAllPackages };
