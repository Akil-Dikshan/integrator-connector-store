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
 * "Most Popular" score of one package.
 *
 * Plain CommonJS on purpose: it is required by scripts/generate-priority-catalogue.js
 * (plain Node, build time) and imported by rest-client.ts (the live list), so the
 * snapshot and the live order can never disagree.
 *
 * It blends two signals, each log-transformed because both spread over orders of magnitude:
 *   - the download rate (downloads per day of the latest mature version, ranking-data.json),
 *     which favours what is used now, but is small for a package that is old and steady
 *     or whose newest version is only a few weeks old;
 *   - the lifetime download count of the whole package, which favours what is established.
 * The rate carries most of the weight; the total keeps a package with a handful of recent
 * downloads from outranking one that many people have used for years.
 */

const RATE_WEIGHT = 0.7;
const TOTAL_WEIGHT = 0.3;

/**
 * @param {number | null | undefined} ratePerDay downloads per day, or none when not ranked
 * @param {number | null | undefined} totalPullCount lifetime downloads of the package
 * @returns {number}
 */
function popularityScore(ratePerDay, totalPullCount) {
  const rate = typeof ratePerDay === 'number' && ratePerDay > 0 ? ratePerDay : 0;
  const total = typeof totalPullCount === 'number' && totalPullCount > 0 ? totalPullCount : 0;
  return RATE_WEIGHT * Math.log10(rate + 1) + TOTAL_WEIGHT * Math.log10(total + 1);
}

module.exports = { popularityScore, RATE_WEIGHT, TOTAL_WEIGHT };
