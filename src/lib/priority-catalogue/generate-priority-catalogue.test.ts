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

import fs from 'fs';
import os from 'os';
import path from 'path';
import { isHiddenPackage, HIDDEN_PACKAGES } from '../connector-utils';
import {
  searchPackages,
  __resetFetchedCatalogCacheForTests,
  __resetRankingDataCacheForTests,
} from '../rest-client/rest-client';

// scripts/generate-priority-catalogue.js is plain CommonJS and runs at build time.
type Raw = Record<string, unknown>;
type Ranking = Record<string, { ratePerDay: number | null }>;
type GeneratorModule = {
  buildPriorityCatalogue: (args: {
    packages: Raw[];
    ranking: Ranking;
    hidden: Set<string>;
    centralCount?: number;
    generatedAt?: string;
  }) => {
    generatedAt: string;
    centralCount: number;
    totalCount: number;
    packages: Array<Record<string, unknown>>;
  };
  clearPriorityCatalogue: (outPath?: string) => void;
  writePriorityCatalogue: (
    packages: Raw[],
    options?: {
      outPath?: string;
      rankingPath?: string;
      hidden?: Set<string>;
      centralCount?: number;
    }
  ) => { totalCount: number };
  isHidden: (pkg: Raw, hidden: Set<string>) => boolean;
};

let generator: GeneratorModule;

beforeAll(async () => {
  generator =
    (await import('../../../scripts/generate-priority-catalogue')) as unknown as GeneratorModule;
});

const raw = (org: string, name: string, extra: Raw = {}): Raw => ({
  id: `${org}-${name}`,
  organization: org,
  name,
  version: '1.0.0',
  URL: `/${org}/${name}/1.0.0`,
  summary: `${name} summary`,
  keywords: ['Area/Finance', 'Type/Connector'],
  icon: `https://example.test/${name}.png`,
  createdDate: 1700000000000,
  pullCount: 10,
  balaURL: 'https://example.test/bala',
  readme: '# long readme',
  modules: [],
  ...extra,
});

const rate = (ratePerDay: number | null) => ({ ratePerDay });
const names = (page: { packages: Array<Record<string, unknown>> }) =>
  page.packages.map((p) => p.name);

describe('buildPriorityCatalogue', () => {
  it('orders by log10(ratePerDay + 1), highest first, unranked and null last', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [
        raw('ballerinax', 'low'),
        raw('ballerinax', 'none'),
        raw('ballerinax', 'high'),
        raw('ballerinax', 'immature'),
      ],
      ranking: {
        'ballerinax/low': rate(1),
        'ballerinax/high': rate(500),
        'ballerinax/immature': rate(null),
      },
      hidden: new Set(),
    });
    expect(names(page)).toEqual(['high', 'low', 'none', 'immature']);
  });

  it('keeps input order for ties, whatever their pull counts (stable, no re-sort)', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [
        raw('ballerinax', 'b', { pullCount: 1 }),
        raw('ballerinax', 'a', { pullCount: 50 }),
        raw('ballerinax', 'c', { pullCount: 7 }),
      ],
      ranking: {},
      hidden: new Set(),
    });
    expect(names(page)).toEqual(['b', 'a', 'c']);
  });

  it('keeps same-named packages from different orgs: identity is org/name', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [raw('ballerina', 'dup'), raw('ballerinax', 'dup'), raw('ballerinax', 'ok')],
      ranking: {},
      hidden: new Set(['ballerina/dup']),
    });
    expect(names(page)).toEqual(['dup', 'ok']);
    expect(page.packages[0].organization).toBe('ballerinax');
  });

  it('records the download rate of each package and the Central count of the build', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [raw('ballerinax', 'a'), raw('ballerinax', 'b'), raw('ballerinax', 'gone')],
      ranking: { 'ballerinax/a': rate(1.23456), 'ballerinax/gone': rate(5) },
      hidden: new Set(['gone']),
      centralCount: 3,
    });
    expect(page.packages.map((p) => p.ratePerDay)).toEqual([1.235, null]);
    expect(page.centralCount).toBe(3);
    expect(page.totalCount).toBe(2);
  });

  it('hides by bare name and by org/name, org-aware', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [
        raw('ballerina', 'sql'),
        raw('ballerinax', 'sql'),
        raw('ballerina', 'dual'),
        raw('ballerinax', 'dual', { version: '2.0.0' }),
        raw('ballerinax', 'keep'),
      ],
      ranking: {},
      hidden: new Set(['sql', 'ballerina/dual']),
    });
    expect(page.packages.map((p) => `${p.organization}/${p.name}`)).toEqual([
      'ballerinax/dual',
      'ballerinax/keep',
    ]);
  });

  it('emits card fields only, mapping pullCount to totalPullCount and keeping numeric createdDate', () => {
    const page = generator.buildPriorityCatalogue({
      packages: [raw('ballerinax', 'one', { pullCount: 42 })],
      ranking: {},
      hidden: new Set(),
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(page).toEqual({
      generatedAt: '2026-01-01T00:00:00.000Z',
      centralCount: 1,
      totalCount: 1,
      packages: [
        {
          name: 'one',
          organization: 'ballerinax',
          version: '1.0.0',
          URL: '/ballerinax/one/1.0.0',
          summary: 'one summary',
          keywords: ['Area/Finance', 'Type/Connector'],
          icon: 'https://example.test/one.png',
          createdDate: 1700000000000,
          totalPullCount: 42,
          ratePerDay: null,
        },
      ],
    });
  });

  it('throws when nothing is left or a card is malformed', () => {
    expect(() =>
      generator.buildPriorityCatalogue({ packages: [], ranking: {}, hidden: new Set() })
    ).toThrow();
    expect(() =>
      generator.buildPriorityCatalogue({
        packages: [raw('ballerinax', 'bad', { URL: '' })],
        ranking: {},
        hidden: new Set(),
      })
    ).toThrow();
  });
});

describe('writePriorityCatalogue / clearPriorityCatalogue', () => {
  let dir: string;
  let outPath: string;
  let rankingPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-catalogue-'));
    outPath = path.join(dir, 'priority-catalogue.json');
    rankingPath = path.join(dir, 'ranking-data.json');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the file from the ranking data, atomically, and returns the page', () => {
    fs.writeFileSync(
      rankingPath,
      JSON.stringify({ packages: { 'ballerinax/b': { ratePerDay: 9 } } })
    );
    const page = generator.writePriorityCatalogue(
      [raw('ballerinax', 'a'), raw('ballerinax', 'b')],
      { outPath, rankingPath, hidden: new Set(), centralCount: 5 }
    );
    expect(page.totalCount).toBe(2);
    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(written.packages.map((p: { name: string }) => p.name)).toEqual(['b', 'a']);
    expect(written).toMatchObject({ totalCount: 2, centralCount: 5 });
    expect(fs.existsSync(`${outPath}.tmp`)).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['unparsable', '{not json'],
    ['without packages', JSON.stringify({ generatedAt: 'x' })],
    ['empty', JSON.stringify({ packages: {} })],
  ])('throws and writes nothing when ranking data is %s', (_label, content) => {
    if (content !== undefined) fs.writeFileSync(rankingPath, content);
    expect(() =>
      generator.writePriorityCatalogue([raw('ballerinax', 'a')], {
        outPath,
        rankingPath,
        hidden: new Set(),
      })
    ).toThrow();
    expect(fs.existsSync(outPath)).toBe(false);
  });

  it('throws and writes nothing when there are no visible packages', () => {
    fs.writeFileSync(rankingPath, JSON.stringify({ packages: { 'a/b': { ratePerDay: 1 } } }));
    expect(() =>
      generator.writePriorityCatalogue([], { outPath, rankingPath, hidden: new Set() })
    ).toThrow();
    expect(fs.existsSync(outPath)).toBe(false);
  });

  it('clearPriorityCatalogue deletes an existing file and tolerates a missing one', () => {
    fs.writeFileSync(outPath, '{"stale":true}');
    generator.clearPriorityCatalogue(outPath);
    expect(fs.existsSync(outPath)).toBe(false);
    expect(() => generator.clearPriorityCatalogue(outPath)).not.toThrow();
  });
});

describe('hidden and deprecated lists', () => {
  it('agrees with the app on every entry of the real lists', () => {
    const entries = new Set<string>(HIDDEN_PACKAGES);
    [...entries].forEach((entry) => {
      const [org, name] = entry.includes('/') ? entry.split('/') : ['ballerinax', entry];
      const pkg = raw(org, name);
      expect(generator.isHidden(pkg, entries)).toBe(isHiddenPackage(pkg as never));
    });
  });

  // Other tools read the copies in public/, so they must match what the app imports.
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

  it.each(['hidden-packages.json', 'deprecated-packages.json'])(
    'public/%s matches src/lib/connector-utils',
    (name) => {
      expect(read(`public/${name}`)).toEqual(read(`src/lib/connector-utils/${name}`));
    }
  );
});

describe('parity with the live default view', () => {
  const mockFetch = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists packages in the same order searchPackages(pullCount-desc) returns them', async () => {
    // Central order (what a pullCount,DESC download returns), with duplicates,
    // hidden packages, ranked, unranked and null-rate ties.
    const catalogue: Raw[] = [];
    for (let i = 0; i < 40; i++) {
      catalogue.push(raw(i % 7 === 0 ? 'ballerina' : 'ballerinax', `pkg${i}`));
    }
    catalogue.splice(9, 0, raw('ballerinax', 'sql')); // hidden by bare name
    const ranking: Ranking = {};
    catalogue.forEach((p, i) => {
      if (i % 3 === 0) ranking[`${p.organization}/${p.name}`] = rate(1000 / (i + 1));
      if (i % 11 === 0) ranking[`${p.organization}/${p.name}`] = rate(null);
    });

    mockFetch.mockImplementation(async (input: string) => {
      if (String(input).includes('ranking-data.json')) {
        return { ok: true, json: async () => ({ packages: ranking }) };
      }
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      return {
        ok: true,
        json: async () => ({
          packages: catalogue.slice(offset, offset + limit),
          count: catalogue.length,
          offset,
          limit,
        }),
      };
    });
    global.fetch = mockFetch;
    __resetFetchedCatalogCacheForTests();
    __resetRankingDataCacheForTests();

    const live: string[] = [];
    let total = 0;
    for (let offset = 0; ; offset += 10) {
      const res = await searchPackages({ offset, limit: 10, sort: 'pullCount-desc' });
      total = res.count;
      if (res.packages.length === 0) break;
      live.push(...res.packages.map((p) => `${p.organization}/${p.name}`));
    }

    const hidden = new Set<string>(
      (await import('../connector-utils/hidden-packages.json')).default as string[]
    );
    const page = generator.buildPriorityCatalogue({ packages: catalogue, ranking, hidden });

    expect(page.packages.map((p) => `${p.organization}/${p.name}`)).toEqual(live);
    expect(page.totalCount).toBe(total);
  });
});
