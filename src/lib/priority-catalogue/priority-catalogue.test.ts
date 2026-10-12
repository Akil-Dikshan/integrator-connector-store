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

import {
  parsePriorityCatalogue,
  loadPriorityCatalogue,
  __resetPriorityCatalogueForTests,
} from './priority-catalogue';

const card = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  organization: 'ballerinax',
  version: '1.0.0',
  URL: `/ballerinax/${name}/1.0.0`,
  summary: 'summary',
  keywords: ['Area/Finance'],
  icon: 'https://example.test/icon.png',
  createdDate: 1700000000000,
  totalPullCount: 5,
  ratePerDay: 1.5,
  ...extra,
});

const file = (packages: unknown[], extra: Record<string, unknown> = {}) => ({
  generatedAt: '2026-10-12T00:00:00.000Z',
  centralCount: packages.length + 2,
  totalCount: packages.length,
  packages,
  ...extra,
});

describe('parsePriorityCatalogue', () => {
  it('accepts a well-formed file, numeric createdDate included', () => {
    const parsed = parsePriorityCatalogue(file([card('a'), card('b')]));
    expect(parsed?.packages.map((p) => p.name)).toEqual(['a', 'b']);
    expect(parsed?.totalCount).toBe(2);
  });

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
    ['an empty object', {}],
    ['no generatedAt', file([card('a')], { generatedAt: undefined })],
    ['empty packages', file([])],
    ['packages not an array', file([], { packages: 'x', totalCount: 0 })],
    ['totalCount mismatch', file([card('a')], { totalCount: 5 })],
    ['totalCount not an integer', file([card('a')], { totalCount: 1.5 })],
    ['a card without name', file([card('a'), card('', {})])],
    ['a card without URL', file([card('a', { URL: '' })])],
    ['a card with bad keywords', file([card('a', { keywords: [1] })])],
    ['a card without ratePerDay', file([card('a', { ratePerDay: undefined })])],
    ['a card with a non-numeric ratePerDay', file([card('a', { ratePerDay: 'fast' })])],
    ['a card with bad createdDate', file([card('a', { createdDate: null })])],
  ])('returns null for %s', (_label, data) => {
    expect(parsePriorityCatalogue(data)).toBeNull();
  });

  it('keeps each download rate and the Central count of the build', () => {
    const parsed = parsePriorityCatalogue(
      file([card('a'), card('b', { ratePerDay: null })], { centralCount: 9 })
    );
    expect(parsed?.packages.map((p) => p.ratePerDay)).toEqual([1.5, null]);
    expect(parsed?.centralCount).toBe(9);
  });

  it('removes hidden packages and lowers the total accordingly', () => {
    // "sql" is in hidden-packages.json
    const parsed = parsePriorityCatalogue(file([card('a'), card('sql'), card('b')]));
    expect(parsed?.packages.map((p) => p.name)).toEqual(['a', 'b']);
    expect(parsed?.totalCount).toBe(2);
  });

  it('returns null when every package is hidden', () => {
    expect(parsePriorityCatalogue(file([card('sql')]))).toBeNull();
  });
});

describe('loadPriorityCatalogue', () => {
  const mockFetch = jest.fn();
  const win = window as unknown as { __BASE_PATH__?: string };

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
    win.__BASE_PATH__ = undefined;
    __resetPriorityCatalogueForTests();
  });

  afterEach(() => {
    win.__BASE_PATH__ = undefined;
  });

  const respond = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => {
      if (typeof body === 'string') return JSON.parse(body);
      return body;
    },
  });

  it('fetches from the site root with cache no-cache and returns the catalogue', async () => {
    mockFetch.mockResolvedValue(respond(file([card('a')])));
    const result = await loadPriorityCatalogue();
    expect(result?.packages).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/priority-catalogue.json', { cache: 'no-cache' });
  });

  it('prefixes window.__BASE_PATH__', async () => {
    win.__BASE_PATH__ = '/integration-platform/store';
    mockFetch.mockResolvedValue(respond(file([card('a')])));
    await loadPriorityCatalogue();
    expect(mockFetch).toHaveBeenCalledWith('/integration-platform/store/priority-catalogue.json', {
      cache: 'no-cache',
    });
  });

  it('shares one request between concurrent and later callers', async () => {
    mockFetch.mockResolvedValue(respond(file([card('a')])));
    await Promise.all([loadPriorityCatalogue(), loadPriorityCatalogue()]);
    await loadPriorityCatalogue();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 404', () => respond({}, { ok: false, status: 404 })],
    [
      'the HTML fallback served with 200',
      () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    ],
    ['an object of the wrong shape', () => respond({ packages: {} })],
    ['an array', () => respond([card('a')])],
  ])('resolves null for %s', async (_label, make) => {
    mockFetch.mockResolvedValue(make());
    await expect(loadPriorityCatalogue()).resolves.toBeNull();
  });

  it('resolves null when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    await expect(loadPriorityCatalogue()).resolves.toBeNull();
  });

  it('resolves null when fetch is not available', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = undefined;
    await expect(loadPriorityCatalogue()).resolves.toBeNull();
  });
});
