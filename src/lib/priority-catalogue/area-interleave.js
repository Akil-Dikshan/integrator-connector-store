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
 *   2. Inside an Area: Connector, then Trigger, then Library, then everything else;
 *      rate order is kept within each type (stable).
 *   3. Rounds: item #1 of every Area, then item #2 of every Area, and so on, with the
 *      Areas always visited in AREA_ORDER (an Area that runs out is skipped).
 *   4. Everything else -- packages whose only Areas are not in AREA_ORDER (Analytics,
 *      DevOps, stray tags like Finance, ...) and packages with no Area -- goes after
 *      all of that, in download-rate order.
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

function interleaveByArea(items) {
  const groups = new Map();
  const rest = [];

  items.forEach((item, index) => {
    const area = areaOf(item.keywords);
    if (area === null) {
      rest.push(item);
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
  return result.concat(rest);
}

module.exports = { interleaveByArea, AREA_ORDER };
