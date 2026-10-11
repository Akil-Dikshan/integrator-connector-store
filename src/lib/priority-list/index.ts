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

/**
 * The build-time priority list (see scripts/generate-priority-list.js): every visible
 * package, hidden and deprecated ones already removed, in default "Most Popular"
 * order, with the card data the store renders.
 */
export interface PriorityListPackage extends BallerinaPackage {
  /** Download rate behind the ranking; null when the package has none. */
  ratePerDay: number | null;
}

export interface PriorityList {
  generatedAt: string;
  /** Total packages Central reported at build time, hidden ones included. */
  centralCount: number;
  packages: PriorityListPackage[];
}

let priorityListPromise: Promise<PriorityList | null> | null = null;

/** Test-only: forgets the loaded list so test cases don't leak state. */
export function __resetPriorityListForTests(): void {
  priorityListPromise = null;
}

function isPriorityList(data: unknown): data is { packages: unknown[] } & Partial<PriorityList> {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { packages?: unknown }).packages) &&
    (data as { packages: unknown[] }).packages.length > 0
  );
}

/**
 * Loads the priority list once per page session. Resolves to null when it is missing
 * or malformed (for example `npm start` without a prior build), so callers can fall
 * back to querying Ballerina Central directly instead of failing.
 */
export function loadPriorityList(): Promise<PriorityList | null> {
  if (!priorityListPromise) {
    priorityListPromise = (async () => {
      try {
        // no-cache: revalidate with the server (ETag) so a redeploy is picked up
        // immediately, while an unchanged file still costs only a 304.
        const response = await fetch(`${window.__BASE_PATH__ || ''}/priority-list.json`, {
          cache: 'no-cache',
        });
        if (!response.ok) return null;
        const data: unknown = await response.json();
        if (!isPriorityList(data)) return null;
        return {
          generatedAt: data.generatedAt ?? '',
          centralCount: data.centralCount ?? data.packages.length,
          // The search API calls it pullCount; the rest of the store reads totalPullCount.
          packages: (data.packages as PriorityListPackage[]).map((pkg) => ({
            ...pkg,
            totalPullCount: pkg.totalPullCount ?? (pkg as { pullCount?: number }).pullCount,
          })),
        };
      } catch (error) {
        console.warn('Priority list unavailable, falling back to Ballerina Central:', error);
        return null;
      }
    })();
  }
  return priorityListPromise;
}
