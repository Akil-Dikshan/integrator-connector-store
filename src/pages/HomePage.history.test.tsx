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
import { render, waitFor, act, fireEvent, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import HomePage from './HomePage';
import { searchPackages, fetchFiltersProgressively } from '@/lib/rest-client';

jest.mock('@/lib/rest-client', () => ({
  searchPackages: jest.fn(),
  fetchFiltersProgressively: jest.fn(),
}));
// Pagination is mocked with real buttons that call the real onPageChange /
// onSortChange props, so the test drives HomePage the way the component does.
// HomePage renders it twice (top and bottom bar), hence getAllBy* below.
jest.mock('@/components/Pagination', () => {
  const mockReact = jest.requireActual('react');
  return (props: { onPageChange: (page: number) => void; onSortChange: (sort: string) => void }) =>
    mockReact.createElement(
      'div',
      null,
      mockReact.createElement('button', { onClick: () => props.onPageChange(2) }, 'go-page-2'),
      mockReact.createElement('button', { onClick: () => props.onPageChange(3) }, 'go-page-3'),
      mockReact.createElement(
        'button',
        { onClick: () => props.onSortChange('date-desc') },
        'change-sort'
      )
    );
});
jest.mock('@/components/ConnectorCard', () => () => null);
jest.mock('@/components/WSO2Header', () => () => null);
jest.mock('@/components/Hero', () => () => null);
jest.mock('@/components/FilterSidebar', () => () => null);
jest.mock('@/components/SearchBar', () => () => null);
jest.mock('@/components/Footer', () => () => null);
jest.mock('@/components/SelectedFilters', () => () => null);

const mockSearchPackages = searchPackages as jest.Mock;
const mockFetchFiltersProgressively = fetchFiltersProgressively as jest.Mock;

const renderHome = async () => {
  const router = createMemoryRouter([{ path: '*', element: <HomePage /> }], {
    initialEntries: ['/'],
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => {
    expect(screen.getAllByText('go-page-2').length).toBeGreaterThan(0);
    expect(mockFetchFiltersProgressively).toHaveBeenCalledTimes(1);
  });
  return router;
};

describe('HomePage browser history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Enough results that pages 2 and 3 are in range (no out-of-range clamp).
    mockSearchPackages.mockImplementation(async ({ offset, limit }) => ({
      packages: [{ name: `pkg-${offset}` }],
      count: 753,
      offset,
      limit,
    }));
    mockFetchFiltersProgressively.mockResolvedValue({ areas: [], vendors: [], types: [] });
  });

  it('pushes a history entry per Pagination click so Back returns to the previous page', async () => {
    const router = await renderHome();

    fireEvent.click(screen.getAllByText('go-page-2')[0]);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
    expect(router.state.historyAction).toBe('PUSH');

    fireEvent.click(screen.getAllByText('go-page-3')[0]);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=3');
    });
    expect(router.state.historyAction).toBe('PUSH');

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
  });

  it('still replaces history for non-page-click updates such as a sort change', async () => {
    const router = await renderHome();

    fireEvent.click(screen.getAllByText('change-sort')[0]);

    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=date-desc');
    });
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
