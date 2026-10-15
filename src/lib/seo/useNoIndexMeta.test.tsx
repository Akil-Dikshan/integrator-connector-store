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

import { renderHook } from '@testing-library/react';
import { useNoIndexMeta } from './useNoIndexMeta';

describe('useNoIndexMeta', () => {
  beforeEach(() => {
    document.title = 'Default title';
    document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  });

  it('does nothing while inactive', () => {
    renderHook(() => useNoIndexMeta(false, 'Not found'));
    expect(document.title).toBe('Default title');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('sets noindex and the title, then restores them on unmount', () => {
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'index, follow');
    document.head.appendChild(robots);

    const { unmount } = renderHook(() => useNoIndexMeta(true, 'Not found'));
    expect(document.title).toBe('Not found');
    expect(robots.getAttribute('content')).toBe('noindex');

    unmount();
    expect(document.title).toBe('Default title');
    expect(robots.getAttribute('content')).toBe('index, follow');
  });

  it('removes a robots tag it created', () => {
    const { unmount } = renderHook(() => useNoIndexMeta(true, 'Not found'));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
