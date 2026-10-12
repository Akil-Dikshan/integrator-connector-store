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

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FilterSidebar from './FilterSidebar';

jest.mock('@/components/SearchBar', () => () => null);

const filterOptions = {
  areas: ['AI', 'Finance', 'Health'],
  vendors: ['Acme', 'Beta', 'Gamma'],
  types: ['Connector', 'Library'],
};

const renderSidebar = (props: Partial<React.ComponentProps<typeof FilterSidebar>> = {}) =>
  render(
    <FilterSidebar
      filterOptions={filterOptions}
      selectedAreas={[]}
      selectedVendors={[]}
      selectedTypes={[]}
      searchQuery=""
      onSearchChange={() => {}}
      onAreaChange={() => {}}
      onVendorChange={() => {}}
      onTypeChange={() => {}}
      onClearAll={() => {}}
      effectiveMode="light"
      {...props}
    />
  );

const labels = () =>
  screen.getAllByRole('checkbox', { hidden: true }).map((c) => c.closest('label')!.textContent);

describe('FilterSidebar facet counts', () => {
  it('lists every option, without counts, when counts are unknown', () => {
    renderSidebar({ facetCounts: null });

    expect(labels()).toEqual([
      'AI',
      'Finance',
      'Health',
      'Acme',
      'Beta',
      'Gamma',
      'Connector',
      'Library',
    ]);
  });

  const checkboxFor = (name: string) =>
    within(screen.getByText(name).closest('label')!).getByRole('checkbox', {
      hidden: true,
    }) as HTMLInputElement;

  it('keeps every option listed, in the usual order, and disables the ones with no results', () => {
    renderSidebar({
      facetCounts: {
        areas: { AI: 1, Finance: 5 },
        vendors: { Acme: 2 },
        types: { Library: 3 },
      },
    });

    expect(labels()).toEqual([
      'AI',
      'Finance',
      'Health',
      'Acme',
      'Beta',
      'Gamma',
      'Connector',
      'Library',
    ]);
    expect(checkboxFor('Health').disabled).toBe(true);
    expect(checkboxFor('Beta').disabled).toBe(true);
    expect(checkboxFor('Connector').disabled).toBe(true);
    expect(checkboxFor('Finance').disabled).toBe(false);
    expect(checkboxFor('Library').disabled).toBe(false);
  });

  it('leaves a selected option enabled even when it now has no results', () => {
    renderSidebar({
      selectedAreas: ['Health'],
      facetCounts: { areas: { Finance: 2 }, vendors: { Acme: 1 }, types: { Library: 1 } },
    });

    expect(checkboxFor('Health').checked).toBe(true);
    expect(checkboxFor('Health').disabled).toBe(false);
  });

  it('keeps every section, with its expanded state, when nothing is available in it', () => {
    renderSidebar({ facetCounts: { areas: { AI: 1 }, vendors: {}, types: {} } });

    expect(screen.getByText('Area')).toBeTruthy();
    expect(screen.getByText('Vendor')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
  });

  it('shows how many options are selected in the section header', () => {
    renderSidebar({
      selectedVendors: ['Acme', 'Beta'],
      facetCounts: { areas: { AI: 1 }, vendors: { Acme: 1, Beta: 1 }, types: { Library: 1 } },
    });

    expect(screen.getByText('(2)')).toBeTruthy();
  });

  it('lists every option however long the list is, leaving scrolling to the section', () => {
    const vendors = Array.from({ length: 30 }, (_, i) => `Vendor${String(i).padStart(2, '0')}`);
    renderSidebar({
      filterOptions: { ...filterOptions, vendors },
      facetCounts: {
        areas: {},
        vendors: Object.fromEntries(vendors.map((v) => [v, 1])),
        types: {},
      },
    });

    expect(labels()).toHaveLength(3 + 30 + 2);
    expect(screen.queryByText(/Show .*more/)).toBeNull();
  });

  it('reports the clicked option', () => {
    const onAreaChange = jest.fn();
    renderSidebar({
      onAreaChange,
      facetCounts: { areas: { Finance: 5 }, vendors: {}, types: {} },
    });

    fireEvent.click(
      within(screen.getByText('Finance').closest('label')!).getByRole('checkbox', { hidden: true })
    );

    expect(onAreaChange).toHaveBeenCalledWith('Finance');
  });
});
