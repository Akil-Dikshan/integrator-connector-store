/*
 Copyright (c) 2026 WSO2 LLC. (http://www.wso2.com) All Rights Reserved.

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

// Pins https://github.com/wso2/product-integrator/issues/2646: packages whose newest
// version is deprecated in Ballerina Central are hidden via deprecated-packages.json,
// which is merged into HIDDEN_PACKAGES and read by the sitemap script.

import hiddenPackages from './hidden-packages.json';
import deprecatedPackages from './deprecated-packages.json';
import { HIDDEN_PACKAGES, isHiddenPackage } from './connector-utils';

type SitemapModule = {
  buildSitemapUrls: (packages: Array<Record<string, string>>) => Array<{ loc: string }>;
};

let sitemap: SitemapModule;

beforeAll(async () => {
  // The script exits at load time when global fetch is missing (jsdom has none).
  global.fetch = jest.fn();
  sitemap = (await import('../../../scripts/generate-sitemap')) as unknown as SitemapModule;
});

const pkg = (org: string, name: string) => ({
  name,
  organization: org,
  URL: `/${org}/${name}/1.0.0`,
});

describe('deprecated-packages.json', () => {
  it('only contains org/name entries', () => {
    deprecatedPackages.forEach((entry: string) => {
      expect(entry).toMatch(/^[a-z0-9_]+\/[A-Za-z0-9_.]+$/);
    });
  });

  it('lists the packages whose newest version is deprecated', () => {
    expect(deprecatedPackages).toEqual(
      expect.arrayContaining(['ballerina/regex', 'ballerina/data.csv'])
    );
  });

  it('does not hold the manually hidden googleapis.calendar', () => {
    expect(deprecatedPackages).not.toContain('ballerinax/googleapis.calendar');
    expect(hiddenPackages).toContain('googleapis.calendar');
  });

  it('is merged into HIDDEN_PACKAGES together with the manual list', () => {
    [...hiddenPackages, ...deprecatedPackages].forEach((entry: string) => {
      expect(HIDDEN_PACKAGES.has(entry)).toBe(true);
    });
  });
});

describe('isHiddenPackage with deprecated and manually hidden entries', () => {
  it.each([
    ['ballerina', 'regex'],
    ['ballerina', 'data.csv'],
    ['ballerinax', 'googleapis.calendar'],
  ])('hides %s/%s', (org, name) => {
    expect(isHiddenPackage({ name, organization: org })).toBe(true);
  });

  it.each([
    ['ballerinax', 'regex'],
    ['ballerinax', 'data.csv'],
  ])('keeps %s/%s visible (entries are org-scoped)', (org, name) => {
    expect(isHiddenPackage({ name, organization: org })).toBe(false);
  });

  it.each([
    ['ballerina', 'task'],
    ['ballerina', 'jwt'],
    ['ballerina', 'xmldata'],
    ['ballerinax', 'snowflake.driver'],
    ['ballerinax', 'ai.agent'],
    ['ballerinax', 'googleapis.gcalendar'],
  ])('keeps %s/%s visible', (org, name) => {
    expect(isHiddenPackage({ name, organization: org })).toBe(false);
  });
});

describe('sitemap', () => {
  it('excludes hidden deprecated packages and keeps the rest', () => {
    const locs = sitemap
      .buildSitemapUrls([
        pkg('ballerina', 'regex'),
        pkg('ballerina', 'data.csv'),
        pkg('ballerinax', 'googleapis.calendar'),
        pkg('ballerina', 'task'),
      ])
      .map((u) => u.loc);

    expect(locs.some((l) => l.includes('/connector/ballerina/regex/latest'))).toBe(false);
    expect(locs.some((l) => l.includes('/connector/ballerina/data.csv/latest'))).toBe(false);
    expect(locs.some((l) => l.includes('/connector/ballerinax/googleapis.calendar/latest'))).toBe(
      false
    );
    expect(locs.some((l) => l.includes('/connector/ballerina/task/latest'))).toBe(true);
  });
});
