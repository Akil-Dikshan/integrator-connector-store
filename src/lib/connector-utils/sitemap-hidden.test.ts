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

// scripts/generate-sitemap.js is plain CommonJS and shares hidden-packages.json
// with the app. These tests pin that the sitemap applies the same hidden check.

import hiddenPackages from './hidden-packages.json';
import { isHiddenPackage } from './connector-utils';

type SitemapModule = {
  buildSitemapUrls: (packages: Array<Record<string, string>>) => Array<{ loc: string }>;
  isHiddenPackage: (org: string | undefined, name: string) => boolean;
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
  createdDate: '2024-01-15T00:00:00Z',
});

describe('generate-sitemap hidden packages', () => {
  it('excludes bare-name hidden packages, whatever the org', () => {
    const urls = sitemap.buildSitemapUrls([
      pkg('ballerina', 'sql'),
      pkg('ballerinax', 'sql'),
      pkg('ballerinax', 'salesforce'),
    ]);
    const locs = urls.map((u) => u.loc);
    expect(locs.some((l) => l.endsWith('/connector/ballerinax/salesforce/latest'))).toBe(true);
    expect(locs.some((l) => l.includes('/sql/'))).toBe(false);
  });

  it('excludes only the matching org for an "org/name" entry', () => {
    let isolated!: SitemapModule;
    jest.isolateModules(() => {
      // The script loads hidden-packages.json itself, so give it a list with an org entry.
      jest.doMock('./hidden-packages.json', () => ['ballerina/dual-org']);
      global.fetch = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      isolated = require('../../../scripts/generate-sitemap') as SitemapModule;
    });
    jest.dontMock('./hidden-packages.json');

    const locs = isolated
      .buildSitemapUrls([pkg('ballerina', 'dual-org'), pkg('ballerinax', 'dual-org')])
      .map((u) => u.loc);
    expect(locs.some((l) => l.endsWith('/connector/ballerina/dual-org/latest'))).toBe(false);
    expect(locs.some((l) => l.endsWith('/connector/ballerinax/dual-org/latest'))).toBe(true);
  });

  it('agrees with isHiddenPackage for every shipped entry (parity)', () => {
    for (const entry of hiddenPackages as string[]) {
      const [org, name] = entry.includes('/') ? entry.split('/') : ['ballerinax', entry];
      expect(sitemap.isHiddenPackage(org, name)).toBe(isHiddenPackage({ name, organization: org }));
      expect(sitemap.isHiddenPackage(org, name)).toBe(true);
    }
  });

  it('keeps the homepage entry', () => {
    const urls = sitemap.buildSitemapUrls([pkg('ballerina', 'sql')]);
    expect(urls).toHaveLength(1);
  });
});
