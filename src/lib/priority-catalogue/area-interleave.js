/*
 Copyright (c) 2026 WSO2 LLC. (http://www.wso2.com).

 WSO2 LLC. licenses this file to you under the Apache License,
 Version 2.0 (the "License"); you may not use this file except
 in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
*/

/**
 * Round-robin ordering of "Most Popular" across Areas.
 *
 * Plain CommonJS on purpose: it is required by scripts/generate-priority-catalogue.js
 * (plain Node, build time) and imported by rest-client.ts (the live default view), so
 * the snapshot and the live list can never disagree on order.
 *
 * Input: items already in download-rate order, each with a `keywords` array.
 * Output: a new array with the same items, none lost or repeated.
 *   1. Each item goes to one of the AREA_ORDER Areas: the first of its `Area/*`
 *      keywords that is in the list (so a package tagged Finance and Healthcare lands
 *      in Healthcare).
 *   2. Popularity floor (only when `rateOf` is given): an item whose download rate is
 *      below `minRate` (MIN_RATE_PER_DAY by default; no rate counts as 0) does not take
 *      part in the rounds, so a barely used package cannot jump ahead of popular ones
 *      just because its Area is next in line. Libraries need a higher rate
 *      (`minLibraryRate`, MIN_LIBRARY_RATE_PER_DAY by default): they rank after
 *      Connectors in their Area, so one only takes the Area's turn when the Area has no
 *      Connector or Trigger above the floor, and then it must be clearly popular. Items
 *      below the floor go to the tail (step 5).
 *   3. Inside an Area: Connector, then Trigger, then Library, then everything else;
 *      rate order is kept within each type (stable).
 *   4. Rounds: item #1 of every Area, then item #2 of every Area, and so on, with the
 *      Areas always visited in AREA_ORDER (an Area that runs out is skipped).
 *   5. Everything else -- items below the floor, packages whose only Areas are not in
 *      AREA_ORDER (Analytics, DevOps, stray tags like Finance, ...) and packages with
 *      no Area -- goes after all of that, in download-rate order.
 */

// Order the Areas are visited in each round (agreed with the team). Names are the
// canonical ones after AREA_ALIASES is applied.
const AREA_ORDER = [
  'CRM & Sales',
  'ERP & Business Operations',
  'Protocol', // "Network & Protocols" -- once Area/Protocol is released
  'Communication',
  'Database',
  'AI & Machine Learning',
  'Messaging',
  'Marketing & Social Media',
  'Storage & File Management',
  'Productivity & Collaboration',
  'Security & Identity',
  'E-Commerce',
  'Cloud & Infrastructure',
  'Finance & Accounting',
  'Healthcare',
  'HRMS',
];

// Renamed tags that count as a listed Area.
const AREA_ALIASES = {
  'Network & Protocols': 'Protocol',
};

// Minimum downloads per day (the ranking's `ratePerDay`) for a package to take a turn in
// the Area rounds. Below it, a package is listed by rate after the interleaved part.
const MIN_RATE_PER_DAY = 5;
// Same, for Type/Library packages, which would otherwise take an Area's turn whenever the
// Area has no Connector above the floor (e.g. a 6-per-day library leading ERP).
const MIN_LIBRARY_RATE_PER_DAY = 25;

const TYPE_ORDER = { Connector: 0, Trigger: 1, Library: 2 };
const OTHER_TYPE_RANK = 3;

// Mirrors parseConnectorMetadata in connector-utils: Built-in is not a user-facing
// Area, and standard libraries don't count as Communication. Returns the first usable
// Area that is in AREA_ORDER, or null when the package has none.
function areaOf(keywords) {
  const list = Array.isArray(keywords) ? keywords : [];
  const isBuiltIn = list.includes('Area/Built-in');
  for (const keyword of list) {
    if (typeof keyword !== 'string' || !keyword.startsWith('Area/')) continue;
    const raw = keyword.slice('Area/'.length);
    if (raw === '' || raw === 'Built-in') continue;
    if (raw === 'Communication' && isBuiltIn) continue;
    const area = AREA_ALIASES[raw] || raw;
    if (AREA_ORDER.includes(area)) return area;
  }
  return null;
}

function typeRankOf(keywords) {
  const list = Array.isArray(keywords) ? keywords : [];
  let rank = OTHER_TYPE_RANK;
  for (const keyword of list) {
    if (typeof keyword !== 'string' || !keyword.startsWith('Type/')) continue;
    const known = TYPE_ORDER[keyword.slice('Type/'.length)];
    if (known !== undefined && known < rank) rank = known;
  }
  return rank;
}

/**
 * @param {Array<{ keywords?: string[] }>} items already in download-rate order
 * @param {{ rateOf?: (item: any) => number | null | undefined, minRate?: number, minLibraryRate?: number }} [options]
 *   `rateOf` returns an item's downloads per day; when given, items below `minRate`
 *   (`minLibraryRate` for Libraries) skip the rounds (see the popularity floor above).
 *   Without it no floor is applied.
 */
function interleaveByArea(items, options = {}) {
  const { rateOf, minRate = MIN_RATE_PER_DAY, minLibraryRate = MIN_LIBRARY_RATE_PER_DAY } = options;
  const groups = new Map();
  // Below-floor and Area-less items, with their input position so they keep rate order.
  const tail = [];

  items.forEach((item, index) => {
    const area = areaOf(item.keywords);
    const floor = typeRankOf(item.keywords) === TYPE_ORDER.Library ? minLibraryRate : minRate;
    const belowFloor = rateOf ? !((rateOf(item) ?? 0) >= floor) : false;
    if (area === null || belowFloor) {
      tail.push({ item, index });
      return;
    }
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push({ item, index, typeRank: typeRankOf(item.keywords) });
  });

  // Explicit index tie-break so the result never depends on sort stability.
  for (const list of groups.values()) {
    list.sort((a, b) => a.typeRank - b.typeRank || a.index - b.index);
  }

  const areas = AREA_ORDER.filter((area) => groups.has(area));
  const longest = areas.reduce((max, area) => Math.max(max, groups.get(area).length), 0);

  const result = [];
  for (let round = 0; round < longest; round++) {
    for (const area of areas) {
      const entry = groups.get(area)[round];
      if (entry) result.push(entry.item);
    }
  }
  tail.sort((a, b) => a.index - b.index);
  return result.concat(tail.map((entry) => entry.item));
}

module.exports = { interleaveByArea, AREA_ORDER, MIN_RATE_PER_DAY, MIN_LIBRARY_RATE_PER_DAY };
