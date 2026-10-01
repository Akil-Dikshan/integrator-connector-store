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
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import HomePage from './HomePage';
import { searchPackages, fetchFiltersProgressively } from '@/lib/rest-client';

// Isolate HomePage's own effect-scheduling logic: stub out every child
// component (their internals aren't what this test is about) and mock the
// network layer directly so call counts can be pinned exactly.
jest.mock('@/lib/rest-client', () => ({
  searchPackages: jest.fn(),
  fetchFiltersProgressively: jest.fn(),
}));
jest.mock('@/components/Pagination', () => () => null);
jest.mock('@/components/ConnectorCard', () => () => null);
jest.mock('@/components/WSO2Header', () => () => null);
jest.mock('@/components/Hero', () => () => null);
jest.mock('@/components/FilterSidebar', () => () => null);
jest.mock('@/components/SearchBar', () => () => null);
jest.mock('@/components/Footer', () => () => null);
jest.mock('@/components/SelectedFilters', () => () => null);

const mockSearchPackages = searchPackages as jest.Mock;
const mockFetchFiltersProgressively = fetchFiltersProgressively as jest.Mock;

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
