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

import { BallerinaPackage } from '@/types/connector';
import { mergePage, packageKey } from './merge';

const pkg = (name: string, extra: Partial<BallerinaPackage> = {}): BallerinaPackage => ({
  name,
  organization: 'ballerinax',
  version: '1.0.0',
  URL: `/ballerinax/${name}/1.0.0`,
  summary: `${name} summary`,
  keywords: ['Area/Finance'],
  icon: 'icon.png',
  createdDate: '1700000000000',
  totalPullCount: 1,
  ...extra,
});

// A live package carries many fields the snapshot does not.
const liveOf = (p: BallerinaPackage, extra: Record<string, unknown> = {}) =>
  ({ ...p, balaURL: 'https://example.test', readme: '# r', ...extra }) as BallerinaPackage;

const names = (list: BallerinaPackage[]) => list.map((p) => p.name);

describe('packageKey', () => {
  it('is org/name, independent of version', () => {
    expect(packageKey(pkg('a'))).toBe('ballerinax/a');
    expect(packageKey(pkg('a', { version: '9.9.9' }))).toBe('ballerinax/a');
    expect(packageKey(pkg('a', { organization: 'ballerina' }))).toBe('ballerina/a');
  });
});

describe('mergePage', () => {
  it('returns the very same array when nothing visible changed', () => {
    const shown = [pkg('a'), pkg('b')];
    const merged = mergePage(
      shown,
      shown.map((p) => liveOf(p))
    );
    expect(merged).toBe(shown);
  });

  it('keeps the shown order and swaps in live objects when a card field changed', () => {
    const shown = [pkg('a'), pkg('b'), pkg('c')];
    const live = [liveOf(pkg('c')), liveOf(pkg('b'), { summary: 'new' }), liveOf(pkg('a'))];
    const merged = mergePage(shown, live);
    expect(names(merged)).toEqual(['a', 'b', 'c']);
    expect(merged[1].summary).toBe('new');
    // unchanged cards keep their snapshot object so they do not re-render
    expect(merged[0]).toBe(shown[0]);
    expect(merged[2]).toBe(shown[2]);
  });

  it('updates version, pull count and keywords in place', () => {
    const shown = [pkg('a')];
    const merged = mergePage(shown, [
      liveOf(pkg('a', { version: '2.0.0', totalPullCount: 99, keywords: ['Area/Other'] })),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].version).toBe('2.0.0');
    expect(merged[0].totalPullCount).toBe(99);
    expect(merged[0].keywords).toEqual(['Area/Other']);
  });

  it('drops packages that are gone from live and inserts new ones at their live index', () => {
    const shown = [pkg('a'), pkg('b'), pkg('c')];
    const live = [liveOf(pkg('n1')), liveOf(pkg('a')), liveOf(pkg('c')), liveOf(pkg('n2'))];
    expect(names(mergePage(shown, live))).toEqual(['n1', 'a', 'c', 'n2']);
  });

  it('always has exactly the live set', () => {
    const shown = [pkg('a'), pkg('b')];
    const live = [liveOf(pkg('x')), liveOf(pkg('y')), liveOf(pkg('b'))];
    const merged = mergePage(shown, live);
    expect([...names(merged)].sort()).toEqual(['b', 'x', 'y']);
  });

  it('handles an empty live page', () => {
    expect(mergePage([pkg('a')], [])).toEqual([]);
  });
});
