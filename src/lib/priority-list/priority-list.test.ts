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

import { loadPriorityList, __resetPriorityListForTests } from './index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const entry = (name: string) => ({
  organization: 'ballerinax',
  name,
  version: '1.0.0',
  URL: `packages/ballerinax/${name}/1.0.0`,
  summary: '',
  keywords: [],
  icon: '',
  createdDate: '2026-01-01T00:00:00Z',
  pullCount: 42,
  ratePerDay: 1.5,
});

const respondWith = (body: unknown, ok = true) =>
  mockFetch.mockResolvedValue({ ok, json: () => Promise.resolve(body) });

describe('loadPriorityList', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    __resetPriorityListForTests();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete window.__BASE_PATH__;
    jest.restoreAllMocks();
  });

  it('maps pullCount to totalPullCount and keeps the build metadata', async () => {
    respondWith({ generatedAt: 'now', centralCount: 10, packages: [entry('twilio')] });

    const list = await loadPriorityList();

    expect(list?.centralCount).toBe(10);
    expect(list?.generatedAt).toBe('now');
    expect(list?.packages[0]).toMatchObject({
      name: 'twilio',
      totalPullCount: 42,
      ratePerDay: 1.5,
    });
  });

  it('revalidates on every load and honours the deployment base path', async () => {
    window.__BASE_PATH__ = '/integration-platform/store';
    respondWith({ packages: [entry('twilio')] });

    await loadPriorityList();

    expect(mockFetch).toHaveBeenCalledWith('/integration-platform/store/priority-list.json', {
      cache: 'no-cache',
    });
  });

  it('is fetched once per page session', async () => {
    respondWith({ packages: [entry('twilio')] });

    await Promise.all([loadPriorityList(), loadPriorityList()]);
    await loadPriorityList();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a missing file', () => respondWith({}, false)],
    ['an empty list', () => respondWith({ packages: [] })],
    ['a malformed body', () => respondWith({ packages: 'nope' })],
    ['a network error', () => mockFetch.mockRejectedValue(new Error('offline'))],
  ])('resolves to null for %s so the store falls back to Central', async (_name, arrange) => {
    arrange();

    await expect(loadPriorityList()).resolves.toBeNull();
  });
});
