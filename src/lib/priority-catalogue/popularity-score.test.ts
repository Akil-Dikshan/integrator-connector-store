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

import { popularityScore, RATE_WEIGHT, TOTAL_WEIGHT } from './popularity-score';

describe('popularityScore', () => {
  it('weights the rate more than the lifetime total, and the weights add up to 1', () => {
    expect(RATE_WEIGHT).toBeGreaterThan(TOTAL_WEIGHT);
    expect(RATE_WEIGHT + TOTAL_WEIGHT).toBeCloseTo(1);
  });

  it('is 0 for a package with no rate and no downloads', () => {
    expect(popularityScore(null, 0)).toBe(0);
    expect(popularityScore(undefined, undefined)).toBe(0);
  });

  it('ranks an established package above a new one with a slightly higher rate', () => {
    // Real figures: sap.jco (506 downloads, 0.67 per day) vs a package with 16 downloads, 0.79 per day.
    expect(popularityScore(0.67, 506)).toBeGreaterThan(popularityScore(0.79, 16));
  });

  it('still ranks a clearly higher rate above a larger total', () => {
    expect(popularityScore(200, 5000)).toBeGreaterThan(popularityScore(5, 50000));
  });

  it('breaks a tie in rate by the total', () => {
    expect(popularityScore(10, 5000)).toBeGreaterThan(popularityScore(10, 50));
  });

  it('scores a package without a rate on its total alone', () => {
    expect(popularityScore(null, 1000)).toBeCloseTo(TOTAL_WEIGHT * Math.log10(1001));
  });
});
