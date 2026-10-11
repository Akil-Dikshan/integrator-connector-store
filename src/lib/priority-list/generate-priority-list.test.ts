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

// scripts/generate-priority-list.js is plain CommonJS. These tests pin that it drops
// hidden and deprecated packages by the same rule as the app, and ranks like the app does.

import fs from 'fs';
import path from 'path';
import { isHiddenPackage, HIDDEN_PACKAGES } from '../connector-utils';

type Generator = {
  buildPriorityList: (
    packages: Array<Record<string, unknown>>,
    hidden: string[],
    ranking: Record<string, { ratePerDay: number | null }>
  ) => Array<{ organization: string; name: string; ratePerDay: number | null }>;
  makeIsHidden: (entries: string[]) => (pkg: { name: string; organization?: string }) => boolean;
};

let generator: Generator;

beforeAll(async () => {
  global.fetch = jest.fn();
  generator = (await import('../../../scripts/generate-priority-list')) as unknown as Generator;
});

const pkg = (organization: string, name: string) => ({
  organization,
  name,
  version: '1.0.0',
  URL: `packages/${organization}/${name}/1.0.0`,
  summary: '',
  keywords: [],
  icon: '',
  createdDate: '2026-01-01T00:00:00Z',
  pullCount: 1,
});

describe('generate-priority-list', () => {
  it('hides by bare name (every org) and by org/name (that org only)', () => {
    const isHidden = generator.makeIsHidden(['sql', 'ballerina/regex']);

    expect(isHidden(pkg('ballerina', 'sql'))).toBe(true);
    expect(isHidden(pkg('ballerinax', 'sql'))).toBe(true);
    expect(isHidden(pkg('ballerina', 'regex'))).toBe(true);
    expect(isHidden(pkg('ballerinax', 'regex'))).toBe(false);
  });

  it('agrees with the app on every entry of the real hidden and deprecated lists', () => {
    const isHidden = generator.makeIsHidden([...HIDDEN_PACKAGES]);

    [...HIDDEN_PACKAGES].forEach((entry) => {
      const [org, name] = entry.includes('/') ? entry.split('/') : ['ballerinax', entry];
      expect(isHidden(pkg(org, name))).toBe(isHiddenPackage(pkg(org, name)));
    });
  });

  it('removes hidden packages and orders the rest by log-scaled download rate', () => {
    const list = generator.buildPriorityList(
      [
        pkg('ballerinax', 'slow'),
        pkg('ballerinax', 'unranked'),
        pkg('ballerinax', 'gone'),
        pkg('ballerinax', 'fast'),
      ],
      ['gone'],
      {
        'ballerinax/slow': { ratePerDay: 2 },
        'ballerinax/fast': { ratePerDay: 900 },
        'ballerinax/gone': { ratePerDay: 5000 },
      }
    );

    expect(list.map((p) => p.name)).toEqual(['fast', 'slow', 'unranked']);
    expect(list[2].ratePerDay).toBeNull();
  });

  it('keeps Central order among packages with equal scores', () => {
    const list = generator.buildPriorityList(
      [pkg('ballerinax', 'b'), pkg('ballerinax', 'a'), pkg('ballerinax', 'c')],
      [],
      {}
    );

    expect(list.map((p) => p.name)).toEqual(['b', 'a', 'c']);
  });
});

describe('public copies of the hidden and deprecated lists', () => {
  // Other tools read these copies, so they must match what the app itself imports.
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

  it.each(['hidden-packages.json', 'deprecated-packages.json'])(
    'public/%s matches src/lib/connector-utils',
    (name) => {
      expect(read(`public/${name}`)).toEqual(read(`src/lib/connector-utils/${name}`));
    }
  );
});
