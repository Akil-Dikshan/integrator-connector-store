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
import { isHiddenPackage } from '@/lib/connector-utils';

/**
 * Every visible package in "Most Popular" order with its card data, built at deploy
 * time by scripts/generate-priority-catalogue.js and served from public/ so the
 * default view can render before Ballerina Central responds. The file is optional:
 * anything missing or malformed means "no snapshot" and the app behaves as before.
 */
export interface PriorityCatalogueCard extends BallerinaPackage {
  /** Download rate behind the ranking; null when the package has none. */
  ratePerDay: number | null;
}

export interface PriorityCatalogue {
  generatedAt: string;
  /** Total packages Central reported at build time, hidden ones included. */
  centralCount: number;
  /** Visible packages in the whole catalogue (after hiding). */
  totalCount: number;
  packages: PriorityCatalogueCard[];
}

function isCard(value: unknown): value is PriorityCatalogueCard {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    p.name !== '' &&
    typeof p.version === 'string' &&
    typeof p.URL === 'string' &&
    p.URL !== '' &&
    typeof p.summary === 'string' &&
    typeof p.icon === 'string' &&
    // Central sends createdDate as epoch milliseconds, typed string in BallerinaPackage.
    (typeof p.createdDate === 'string' || Number.isFinite(p.createdDate)) &&
    Array.isArray(p.keywords) &&
    p.keywords.every((k) => typeof k === 'string') &&
    (p.organization === undefined || typeof p.organization === 'string') &&
    (p.totalPullCount === undefined || typeof p.totalPullCount === 'number') &&
    (p.ratePerDay === null || (typeof p.ratePerDay === 'number' && Number.isFinite(p.ratePerDay)))
  );
}

/**
 * Validates the raw file contents. Anything that is not exactly the expected shape
 * yields null. Hidden packages are removed here too, in case the hide lists changed
 * after the file was generated, and the total follows.
 */
export function parsePriorityCatalogue(data: unknown): PriorityCatalogue | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { generatedAt, centralCount, totalCount, packages } = data as Record<string, unknown>;
  if (typeof generatedAt !== 'string') return null;
  if (!Array.isArray(packages) || packages.length === 0) return null;
  // A truncated or hand-edited file does not match its own total.
  if (totalCount !== packages.length) return null;
  if (!packages.every(isCard)) return null;

  const visible = packages.filter((pkg) => !isHiddenPackage(pkg));
  if (visible.length === 0) return null;

  return {
    generatedAt,
    centralCount: typeof centralCount === 'number' ? centralCount : packages.length,
    totalCount: visible.length,
    packages: visible,
  };
}

let loadPromise: Promise<PriorityCatalogue | null> | null = null;

/** Test-only: forgets the loaded catalogue so cases don't leak state. */
export function __resetPriorityCatalogueForTests(): void {
  loadPromise = null;
}

/**
 * Fetches the file once per page session. Never rejects: a missing file, a 404, the
 * SPA's HTML fallback (served with 200), bad JSON or the wrong shape all give null.
 * no-cache because the file name is not hashed: revalidate, don't trust a stale copy.
 */
export function loadPriorityCatalogue(): Promise<PriorityCatalogue | null> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        if (typeof fetch !== 'function') return null;
        const response = await fetch(`${window.__BASE_PATH__ || ''}/priority-catalogue.json`, {
          cache: 'no-cache',
        });
        if (!response.ok) return null;
        const catalogue = parsePriorityCatalogue(await response.json());
        if (!catalogue)
          console.warn('priority-catalogue.json is not valid; querying Central instead.');
        return catalogue;
      } catch {
        return null;
      }
    })();
  }
  return loadPromise;
}
