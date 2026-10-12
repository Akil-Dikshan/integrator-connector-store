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

// Fields a ConnectorCard shows; the live response carries many more.
const CARD_FIELDS = [
  'name',
  'organization',
  'version',
  'URL',
  'summary',
  'icon',
  'createdDate',
  'totalPullCount',
] as const;

/** Identity of a connector across versions: org/name. */
export function packageKey(pkg: Pick<BallerinaPackage, 'name' | 'organization'>): string {
  return `${pkg.organization ?? ''}/${pkg.name}`;
}

function sameCard(a: BallerinaPackage, b: BallerinaPackage): boolean {
  return (
    CARD_FIELDS.every((field) => a[field] === b[field]) &&
    a.keywords.length === b.keywords.length &&
    a.keywords.every((keyword, i) => keyword === b.keywords[i])
  );
}

/**
 * Merges the live page into the cards on screen, by package key. Cards present in
 * both keep their position (and their object, when no card field changed, so React
 * leaves them alone); cards gone from live are dropped; cards new to the page are
 * inserted at their live index. The result is always exactly the live set.
 */
export function mergePage(shown: BallerinaPackage[], live: BallerinaPackage[]): BallerinaPackage[] {
  const liveByKey = new Map(live.map((pkg) => [packageKey(pkg), pkg]));

  const merged: BallerinaPackage[] = [];
  const kept = new Set<string>();
  for (const current of shown) {
    const key = packageKey(current);
    const fresh = liveByKey.get(key);
    if (!fresh || kept.has(key)) continue;
    kept.add(key);
    merged.push(sameCard(current, fresh) ? current : fresh);
  }

  live.forEach((pkg, index) => {
    if (!kept.has(packageKey(pkg))) {
      kept.add(packageKey(pkg));
      merged.splice(Math.min(index, merged.length), 0, pkg);
    }
  });

  const unchanged = merged.length === shown.length && merged.every((pkg, i) => pkg === shown[i]);
  return unchanged ? shown : merged;
}
