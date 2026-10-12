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

import React from 'react';
import { render, waitFor, act, screen } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import HomePage from './HomePage';
import { searchPackages, fetchFiltersProgressively } from '@/lib/rest-client';
import {
  loadPriorityCatalogue,
  __resetPriorityCatalogueForTests,
} from '@/lib/priority-catalogue/priority-catalogue';

// Isolate HomePage's own effect-scheduling logic: stub out every child
// component (their internals aren't what this test is about) and mock the
// network layer directly so call counts can be pinned exactly.
jest.mock('@/lib/rest-client', () => ({
  searchPackages: jest.fn(),
  fetchFiltersProgressively: jest.fn(),
}));
// Pagination records the props it receives so a test can read the total HomePage passes.
const mockPaginationProps = [] as Array<{ totalItems: number; currentPage: number }>;
jest.mock('@/components/Pagination', () => (props: { totalItems: number; currentPage: number }) => {
  mockPaginationProps.push(props);
  return null;
});
// One element per card, so a test can check which cards are on screen and whether
// the same DOM node survives a refresh.
jest.mock(
  '@/components/ConnectorCard',
  () => (props: { connector: { name: string; summary?: string } }) => (
    <div data-testid="card">{`${props.connector.name}|${props.connector.summary ?? ''}`}</div>
  )
);
jest.mock('@/components/WSO2Header', () => () => null);
jest.mock('@/components/Hero', () => () => null);
// FilterSidebar is stubbed but records the props it receives, so a test can
// assert on the filter options HomePage hands to it.
const mockFilterSidebarProps = [] as unknown[];
jest.mock('@/components/FilterSidebar', () => (props: { filterOptions: unknown }) => {
  mockFilterSidebarProps.push(props);
  return null;
});
jest.mock('@/components/SearchBar', () => () => null);
jest.mock('@/components/Footer', () => () => null);
jest.mock('@/components/SelectedFilters', () => () => null);

const mockSearchPackages = searchPackages as jest.Mock;
const mockFetchFiltersProgressively = fetchFiltersProgressively as jest.Mock;

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFilterSidebarProps.length = 0;
    mockPaginationProps.length = 0;
    mockSearchPackages.mockResolvedValue({ packages: [], count: 0, offset: 0, limit: 30 });
    mockFetchFiltersProgressively.mockResolvedValue({ areas: [], vendors: [], types: [] });
  });

  it('fetches the initial page exactly once on mount, not twice', async () => {
    // Regression test for a pre-existing bug that predates the ranking-v2
    // branch entirely: the mount-only effect calls fetchPageData() directly,
    // then flips initialLoading to false -- which on its own satisfied the
    // separate "fetch when filters/sort/page change" effect's guard and
    // fired a second, fully redundant fetch for identical params on every
    // page load. This was invisible while the default sort ('pullCount-desc')
    // took a single cheap request; it became a real, visible problem once
    // that sort started requiring a multi-request full-fetch cycle (see
    // skipInitialLoadingFetchRef in HomePage.tsx). Pinning the exact call
    // count here (not "at least once" or "a reasonable number of times") is
    // the point -- a return of the duplicate must fail this test.
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetchFiltersProgressively).toHaveBeenCalledTimes(1);
    });

    expect(mockSearchPackages).toHaveBeenCalledTimes(1);
  });

  it('still fetches again on a real filter/sort/page change after mount', async () => {
    // Guards against a fix that's too aggressive: skipInitialLoadingFetchRef
    // must only suppress the one mount-caused duplicate, not any later
    // legitimate fetch. MemoryRouter's initialEntries only applies at
    // construction (a rerender with new initialEntries does NOT navigate),
    // so a real programmatic navigation is used here via createMemoryRouter,
    // to actually change the URL search params -- which changes
    // fetchPageData's dependencies (sortBy) and must trigger a new fetch.
    const router = createMemoryRouter([{ path: '*', element: <HomePage /> }], {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(mockSearchPackages).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await router.navigate('/?sort=date-desc');
    });

    await waitFor(() => {
      expect(mockSearchPackages.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('shows the predefined Type list, ignoring fetched types (e.g. Util)', async () => {
    mockFetchFiltersProgressively.mockResolvedValue({
      areas: [],
      vendors: ['Acme'],
      types: ['Util', 'Connector', 'Something New'],
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFilterSidebarProps.length).toBeGreaterThan(0);
    });

    const { filterOptions } = mockFilterSidebarProps[mockFilterSidebarProps.length - 1] as {
      filterOptions: { types: string[]; vendors: string[] };
    };
    expect(filterOptions.types).toEqual([
      'Connector',
      'Data Loader',
      'Driver',
      'Embedding Provider',
      'Knowledge Base',
      'Library',
      'Model Provider',
      'Short Term Memory Store',
      'Trigger',
      'Vector Store',
    ]);
    expect(filterOptions.vendors).toEqual(['Acme']);
  });

  it('clamps an out-of-range ?page= to the last page on initial load', async () => {
    // /?page=999 against 753 results at the default page size of 30 has 26
    // pages. The first request (offset 29940) comes back empty; HomePage must
    // refetch the last page (offset 750) and write page 26 back to the URL.
    const total = 753;
    mockSearchPackages.mockImplementation(async ({ offset, limit }) => ({
      packages: offset >= total ? [] : [{ name: `pkg-${offset}` }],
      count: total,
      offset,
      limit,
    }));

    const router = createMemoryRouter([{ path: '*', element: <HomePage /> }], {
      initialEntries: ['/?page=999'],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=26');
    });

    const offsets = mockSearchPackages.mock.calls.map(([args]) => args.offset);
    expect(offsets).toEqual([29940, 750]);
  });
});

// The priority catalogue (public/priority-catalogue.json) renders the default view
// before Ballerina Central answers; the live response is then merged in place.
describe('HomePage with a priority catalogue', () => {
  const mockFetch = jest.fn();

  const snapshotCard = (i: number, extra: Record<string, unknown> = {}) => ({
    name: `pkg${i}`,
    organization: 'ballerinax',
    version: '1.0.0',
    URL: `/ballerinax/pkg${i}/1.0.0`,
    summary: `snap${i}`,
    keywords: [],
    icon: 'i.png',
    createdDate: 1700000000000,
    totalPullCount: 1,
    ...extra,
  });
  const SNAPSHOT_SIZE = 80;
  const snapshotFile = () => ({
    generatedAt: '2026-10-12T00:00:00.000Z',
    totalCount: SNAPSHOT_SIZE,
    packages: Array.from({ length: SNAPSHOT_SIZE }, (_, i) => snapshotCard(i)),
  });

  // What searchPackages returns for the same page: snapshot cards plus fields the
  // snapshot does not carry.
  const livePage = (from: number, to: number, overrides: Record<number, object> = {}) =>
    Array.from({ length: to - from }, (_, k) => ({
      ...snapshotCard(from + k),
      balaURL: 'https://example.test/bala',
      ...(overrides[from + k] ?? {}),
    }));

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const cardTexts = () => screen.queryAllByTestId('card').map((el) => el.textContent);
  const priorityCalls = () =>
    mockFetch.mock.calls.filter(([url]) => String(url).includes('priority-catalogue.json'));

  const renderAt = (url: string, strict = false) => {
    const router = createMemoryRouter([{ path: '*', element: <HomePage /> }], {
      initialEntries: [url],
    });
    const tree = <RouterProvider router={router} />;
    render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
    return router;
  };

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFilterSidebarProps.length = 0;
    mockPaginationProps.length = 0;
    __resetPriorityCatalogueForTests();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => snapshotFile() });
    global.fetch = mockFetch;
    mockFetchFiltersProgressively.mockResolvedValue({ areas: [], vendors: [], types: [] });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch;
  });

  it('paints the first page and the total from the file while Central is still pending', async () => {
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    renderAt('/');

    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));
    expect(cardTexts()[0]).toBe('pkg0|snap0');
    expect(cardTexts()[29]).toBe('pkg29|snap29');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockPaginationProps[mockPaginationProps.length - 1].totalItems).toBe(SNAPSHOT_SIZE);
  });

  it('serves any page and page size of the default view from the file', async () => {
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    renderAt('/?page=3&size=10');

    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));
    expect(cardTexts()[0]).toBe('pkg20|snap20');
    expect(cardTexts()[9]).toBe('pkg29|snap29');
  });

  it('keeps the same DOM nodes and updates changed fields when live data merges in', async () => {
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));
    const before = screen.getAllByTestId('card');

    await act(async () => {
      live.resolve({
        packages: livePage(0, 30, { 4: { summary: 'fresh4' } }),
        count: SNAPSHOT_SIZE + 3,
        offset: 0,
        limit: 30,
      });
    });

    await waitFor(() => expect(cardTexts()[4]).toBe('pkg4|fresh4'));
    const after = screen.getAllByTestId('card');
    expect(after).toHaveLength(30);
    after.forEach((node, i) => expect(node).toBe(before[i]));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockPaginationProps[mockPaginationProps.length - 1].totalItems).toBe(SNAPSHOT_SIZE + 3);
  });

  it('inserts packages new to the page and drops the ones that left it', async () => {
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    // pkg3 left the page, "fresh" is new at index 0.
    const page = [
      ...livePage(0, 3),
      ...livePage(4, 10),
      { ...snapshotCard(100, { name: 'fresh', summary: 'new' }) },
    ];
    page.unshift(page.pop()!);
    await act(async () => {
      live.resolve({ packages: page, count: SNAPSHOT_SIZE, offset: 0, limit: 10 });
    });

    await waitFor(() => expect(cardTexts()).toContain('fresh|new'));
    expect(cardTexts()).toEqual([
      'fresh|new',
      'pkg0|snap0',
      'pkg1|snap1',
      'pkg2|snap2',
      'pkg4|snap4',
      'pkg5|snap5',
      'pkg6|snap6',
      'pkg7|snap7',
      'pkg8|snap8',
      'pkg9|snap9',
    ]);
  });

  it('keeps the snapshot cards and shows no error when the live fetch fails', async () => {
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));

    await act(async () => {
      live.reject(new Error('Central is down'));
    });

    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(screen.queryAllByTestId('card')).toHaveLength(30);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still shows the error when there is no snapshot to fall back on', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    mockSearchPackages.mockRejectedValue(new Error('Central is down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderAt('/');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Central is down'));
    errorSpy.mockRestore();
  });

  it.each([
    ['a 404', () => ({ ok: false, status: 404, json: async () => ({}) })],
    [
      'the HTML fallback',
      () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    ],
    ['the wrong shape', () => ({ ok: true, status: 200, json: async () => ({ packages: [] }) })],
  ])('behaves exactly as without the file for %s', async (_label, make) => {
    mockFetch.mockResolvedValue(make());
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/');

    await waitFor(() => expect(priorityCalls()).toHaveLength(1));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryAllByTestId('card')).toHaveLength(0);

    await act(async () => {
      live.resolve({ packages: livePage(0, 30), count: 80, offset: 0, limit: 30 });
    });
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));
  });

  it('does not use the file for a search, a filter or another sort', async () => {
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    renderAt('/?search=sql');
    renderAt('/?areas=Finance');
    renderAt('/?sort=date-desc');

    await waitFor(() => expect(mockSearchPackages).toHaveBeenCalledTimes(3));
    expect(priorityCalls()).toHaveLength(0);
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
  });

  it('uses the page of an out-of-range ?page= from Central, not from the file', async () => {
    mockSearchPackages.mockImplementation(async ({ offset, limit }) => ({
      packages: offset >= SNAPSHOT_SIZE ? [] : livePage(offset, Math.min(offset + limit, 80)),
      count: SNAPSHOT_SIZE,
      offset,
      limit,
    }));
    const router = renderAt('/?page=999');

    await waitFor(() => expect(router.state.location.search).toBe('?page=3'));
    expect(mockSearchPackages.mock.calls.map(([a]) => a.offset)).toEqual([29940, 60]);
  });

  it('ignores a file that arrives after live data has landed', async () => {
    const file = deferred<unknown>();
    mockFetch.mockReturnValue(file.promise);
    mockSearchPackages.mockResolvedValue({
      packages: livePage(0, 30, { 0: { summary: 'live0' } }),
      count: 80,
      offset: 0,
      limit: 30,
    });
    renderAt('/');
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg0|live0'));

    await act(async () => {
      file.resolve({ ok: true, status: 200, json: async () => snapshotFile() });
    });

    expect(cardTexts()[0]).toBe('pkg0|live0');
    expect(screen.queryAllByTestId('card')).toHaveLength(30);
  });

  it('does not apply a late file to a view the user has since left', async () => {
    const file = deferred<unknown>();
    mockFetch.mockReturnValue(file.promise);
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    const router = renderAt('/');
    await waitFor(() => expect(mockSearchPackages).toHaveBeenCalledTimes(1));

    await act(async () => {
      await router.navigate('/?sort=date-desc');
    });
    await act(async () => {
      file.resolve({ ok: true, status: 200, json: async () => snapshotFile() });
    });

    expect(screen.queryAllByTestId('card')).toHaveLength(0);
  });

  it('does not swallow the next real fetch after the file cleared the initial loading state', async () => {
    // The file lands while the first live fetch is in flight and clears the page
    // spinner itself; initialize() must then not re-arm the skip flag, or the next
    // genuine change (here a sort change) would be dropped.
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValueOnce(live.promise);
    const router = renderAt('/');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));

    await act(async () => {
      live.resolve({ packages: livePage(0, 30), count: 80, offset: 0, limit: 30 });
    });
    await waitFor(() => expect(mockFetchFiltersProgressively).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockSearchPackages).toHaveBeenCalledTimes(1);

    mockSearchPackages.mockResolvedValue({ packages: [], count: 0, offset: 0, limit: 30 });
    await act(async () => {
      await router.navigate('/?sort=date-desc');
    });

    await waitFor(() => expect(mockSearchPackages).toHaveBeenCalledTimes(2));
    expect(mockSearchPackages.mock.calls[1][0].sort).toBe('date-desc');
  });

  it('keeps the snapshot order for cards present in both, even if live ranks them differently', async () => {
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      live.resolve({
        packages: [...livePage(0, 10, { 0: { summary: 'fresh0' } })].reverse(),
        count: SNAPSHOT_SIZE,
        offset: 0,
        limit: 10,
      });
    });

    await waitFor(() => expect(cardTexts()[0]).toBe('pkg0|fresh0'));
    expect(cardTexts().map((t) => t!.split('|')[0])).toEqual(
      Array.from({ length: 10 }, (_, i) => `pkg${i}`)
    );
  });

  it('updates a card in place when its version changed (same node, no remount)', async () => {
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));
    const before = screen.getAllByTestId('card');

    await act(async () => {
      live.resolve({
        packages: livePage(0, 10, { 2: { version: '9.9.9', summary: 'bumped2' } }),
        count: SNAPSHOT_SIZE,
        offset: 0,
        limit: 10,
      });
    });

    await waitFor(() => expect(cardTexts()[2]).toBe('pkg2|bumped2'));
    expect(screen.getAllByTestId('card')[2]).toBe(before[2]);
  });

  it('shows the spinner when the user changes page and the catalogue is not loaded', async () => {
    // No catalogue (404) and the first live fetch failed, so the page is interactive
    // with nothing to serve a slice from: today's path applies.
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const second = deferred<unknown>();
    mockSearchPackages
      .mockRejectedValueOnce(new Error('Central is down'))
      .mockReturnValueOnce(second.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await act(async () => {
      await router.navigate('/?size=10&page=2');
    });

    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('serves a page change from the catalogue before live data lands, without a spinner', async () => {
    const live = deferred<unknown>();
    const page2 = deferred<unknown>();
    mockSearchPackages.mockReturnValueOnce(live.promise).mockReturnValueOnce(page2.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=10&page=2');
    });

    // Page 2 comes straight from the catalogue; the live request is still pending.
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg10|snap10'));
    expect(screen.queryAllByTestId('card')).toHaveLength(10);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockSearchPackages).toHaveBeenCalledTimes(2);
    expect(mockSearchPackages.mock.calls[1][0].offset).toBe(10);

    // ...and the live page 2 then merges in place.
    const before = screen.getAllByTestId('card');
    await act(async () => {
      page2.resolve({
        packages: livePage(10, 20, { 12: { summary: 'fresh12' } }),
        count: SNAPSHOT_SIZE,
        offset: 10,
        limit: 10,
      });
    });
    await waitFor(() => expect(cardTexts()[2]).toBe('pkg12|fresh12'));
    screen.getAllByTestId('card').forEach((node, i) => expect(node).toBe(before[i]));
  });

  it('serves a page-size change from the catalogue before live data lands', async () => {
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=50');
    });

    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(50));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('drops the response of an earlier page when the user moves on quickly', async () => {
    const first = deferred<unknown>();
    const page2 = deferred<unknown>();
    const page3 = deferred<unknown>();
    mockSearchPackages
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(page2.promise)
      .mockReturnValueOnce(page3.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=10&page=2');
    });
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg10|snap10'));
    await act(async () => {
      await router.navigate('/?size=10&page=3');
    });
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg20|snap20'));
    expect(mockSearchPackages).toHaveBeenCalledTimes(3);

    // The page-2 response arrives late and must not touch the page-3 cards.
    await act(async () => {
      page2.resolve({
        packages: livePage(10, 20, { 10: { summary: 'stale10' } }),
        count: SNAPSHOT_SIZE,
        offset: 10,
        limit: 10,
      });
    });
    expect(cardTexts()[0]).toBe('pkg20|snap20');
    expect(screen.queryByRole('progressbar')).toBeNull();

    await act(async () => {
      page3.resolve({
        packages: livePage(20, 30, { 20: { summary: 'fresh20' } }),
        count: SNAPSHOT_SIZE,
        offset: 20,
        limit: 10,
      });
    });
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg20|fresh20'));
    expect(screen.queryAllByTestId('card')).toHaveLength(10);
  });

  it('falls back to the normal path for a page beyond the catalogue', async () => {
    const second = deferred<unknown>();
    mockSearchPackages
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockReturnValueOnce(second.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=10&page=99');
    });

    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
  });

  it('uses the normal path for a page change once live data has landed', async () => {
    const second = deferred<unknown>();
    mockSearchPackages
      .mockResolvedValueOnce({
        packages: livePage(0, 10),
        count: SNAPSHOT_SIZE,
        offset: 0,
        limit: 10,
      })
      .mockReturnValueOnce(second.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(mockFetchFiltersProgressively).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));
    await act(async () => {});

    await act(async () => {
      await router.navigate('/?size=10&page=2');
    });

    // Cached path as today: spinner while the request is pending, no catalogue slice.
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    expect(screen.queryAllByTestId('card')).toHaveLength(0);

    await act(async () => {
      second.resolve({
        packages: livePage(10, 20),
        count: SNAPSHOT_SIZE,
        offset: 10,
        limit: 10,
      });
    });
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg10|snap10'));
  });

  it('uses the normal path for a search before live data lands, and a stale slice never overwrites it', async () => {
    const first = deferred<unknown>();
    const search = deferred<unknown>();
    mockSearchPackages.mockReturnValueOnce(first.promise).mockReturnValueOnce(search.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=10&search=sql');
    });

    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
    expect(mockSearchPackages.mock.calls[1][0].query).toBe('sql');

    // The superseded default-view response lands first, then the search results.
    await act(async () => {
      first.resolve({ packages: livePage(0, 10), count: SNAPSHOT_SIZE, offset: 0, limit: 10 });
    });
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await act(async () => {
      search.resolve({
        packages: [snapshotCard(5, { name: 'sqlmatch', summary: 'hit' })],
        count: 1,
        offset: 0,
        limit: 10,
      });
    });
    await waitFor(() => expect(cardTexts()).toEqual(['sqlmatch|hit']));
  });

  it('does not let an older response overwrite a newer view', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockSearchPackages.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const router = renderAt('/?size=10');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(10));

    await act(async () => {
      await router.navigate('/?size=10&page=2');
    });
    await waitFor(() => expect(mockSearchPackages).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve({ packages: livePage(10, 20), count: SNAPSHOT_SIZE, offset: 10, limit: 10 });
    });
    await waitFor(() => expect(cardTexts()[0]).toBe('pkg10|snap10'));

    await act(async () => {
      first.resolve({ packages: livePage(0, 10), count: SNAPSHOT_SIZE, offset: 0, limit: 10 });
    });

    expect(cardTexts()[0]).toBe('pkg10|snap10');
  });

  it('does not show an error when the filter options fail to load while catalogue cards are on screen', async () => {
    // Central unreachable: the live refresh and the filter options both fail. The
    // distinct messages tell the two sources apart if an Alert ever appears.
    const live = deferred<unknown>();
    mockSearchPackages.mockReturnValue(live.promise);
    mockFetchFiltersProgressively.mockRejectedValue(new Error('Filters unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderAt('/');
    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));

    await act(async () => {
      live.reject(new Error('Central is down'));
    });
    await waitFor(() => expect(mockFetchFiltersProgressively).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryAllByTestId('card')).toHaveLength(30);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('filter options'),
      expect.objectContaining({ message: 'Filters unavailable' })
    );
    errorSpy.mockRestore();
  });

  it('clears an error raised before the catalogue arrived, once its cards are shown', async () => {
    // Central fails fast, before the file lands: today's error path runs, and the
    // catalogue then paints the cards. The stale Alert must not stay on top of them.
    const file = deferred<unknown>();
    mockFetch.mockReturnValue(file.promise);
    mockSearchPackages.mockRejectedValue(new Error('Central is down'));
    mockFetchFiltersProgressively.mockRejectedValue(new Error('Filters unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderAt('/');
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await act(async () => {
      file.resolve({ ok: true, status: 200, json: async () => snapshotFile() });
    });

    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));
    expect(screen.queryByRole('alert')).toBeNull();
    errorSpy.mockRestore();
  });

  it('still shows the error when the filter options fail and no catalogue cards are on screen', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    mockSearchPackages.mockResolvedValue({
      packages: livePage(0, 30),
      count: SNAPSHOT_SIZE,
      offset: 0,
      limit: 30,
    });
    mockFetchFiltersProgressively.mockRejectedValue(new Error('Filters unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderAt('/');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Filters unavailable'));
    errorSpy.mockRestore();
  });

  it('renders synchronously on mount when the file is already loaded', async () => {
    await loadPriorityCatalogue();
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    renderAt('/');
    expect(screen.queryAllByTestId('card')).toHaveLength(30);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('requests the file once under StrictMode', async () => {
    mockSearchPackages.mockReturnValue(new Promise(() => undefined));
    renderAt('/', true);

    await waitFor(() => expect(screen.queryAllByTestId('card')).toHaveLength(30));
    expect(priorityCalls()).toHaveLength(1);
  });
});
