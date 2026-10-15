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
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { OxygenUIThemeProvider } from '@wso2/oxygen-ui';
import { lightTheme } from '@/styles/theme';
import ConnectorDetailPage from './ConnectorDetailPage';
import { fetchPackageDetails } from '@/lib/rest-client';
import { fetchMIConnector } from '@/lib/mi-connector';
import { HIDDEN_PACKAGES } from '@/lib/connector-utils';

jest.mock('@/lib/rest-client', () => ({
  fetchPackageDetails: jest.fn(),
}));
jest.mock('@/lib/mi-connector', () => ({
  fetchMIConnector: jest.fn(),
}));
jest.mock('@/components/WSO2Header', () => () => null);
jest.mock('@/components/Footer', () => () => null);
jest.mock('@/components/BreadcrumbsNav', () => () => null);
jest.mock('@/components/MarkdownContent', () => () => null);

const mockFetchPackageDetails = fetchPackageDetails as jest.Mock;
const mockFetchMIConnector = fetchMIConnector as jest.Mock;

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/connector/:org/:name', element: <ConnectorDetailPage /> },
      { path: '/connector/:org/:name/:version', element: <ConnectorDetailPage /> },
    ],
    { initialEntries: [path] }
  );
  return render(
    <OxygenUIThemeProvider theme={lightTheme}>
      <RouterProvider router={router} />
    </OxygenUIThemeProvider>
  );
};

describe('ConnectorDetailPage hidden packages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // CRA resets mock implementations between tests, which empties the matchMedia stub
    // from setupTests.ts; the page and the theme provider both read `.matches` from it.
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
    mockFetchPackageDetails.mockRejectedValue(new Error('unexpected fetch'));
    mockFetchMIConnector.mockResolvedValue(null);
  });

  it('shows "not found" for a hidden package and never fetches anything', async () => {
    renderAt('/connector/ballerina/sql/latest');

    expect(await screen.findByText('Connector not found')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    expect(mockFetchPackageDetails).not.toHaveBeenCalled();
    expect(mockFetchMIConnector).not.toHaveBeenCalled();
  });

  it('still fetches a package that is not hidden', async () => {
    renderAt('/connector/ballerinax/not-a-hidden-package/latest');

    await waitFor(() => {
      expect(mockFetchPackageDetails).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Connector not found')).not.toBeInTheDocument();
  });

  it('hides only the matching org for an "org/name" entry', async () => {
    HIDDEN_PACKAGES.add('ballerina/dual-org');
    try {
      renderAt('/connector/ballerina/dual-org/latest');
      expect(await screen.findByText('Connector not found')).toBeInTheDocument();
      expect(mockFetchPackageDetails).not.toHaveBeenCalled();
    } finally {
      HIDDEN_PACKAGES.delete('ballerina/dual-org');
    }
  });

  it('does not hide the other org for an "org/name" entry', async () => {
    HIDDEN_PACKAGES.add('ballerina/dual-org');
    try {
      renderAt('/connector/ballerinax/dual-org/latest');
      await waitFor(() => {
        expect(mockFetchPackageDetails).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText('Connector not found')).not.toBeInTheDocument();
    } finally {
      HIDDEN_PACKAGES.delete('ballerina/dual-org');
    }
  });
});
