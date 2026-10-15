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

import { useEffect } from 'react';

/**
 * While `active`, marks the page as not indexable and sets a not-found title.
 * The app serves these states with HTTP 200, so without this search engines would
 * index them as soft 404s. The previous title and robots tag are restored on cleanup.
 */
export function useNoIndexMeta(active: boolean, title: string): void {
  useEffect(() => {
    if (!active) return;

    const previousTitle = document.title;
    let robots = document.querySelector('meta[name="robots"]');
    const createdRobots = !robots;
    const previousRobots = robots?.getAttribute('content') ?? null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }

    document.title = title;
    robots.setAttribute('content', 'noindex');

    return () => {
      document.title = previousTitle;
      if (createdRobots) {
        robots?.remove();
      } else if (previousRobots !== null) {
        robots?.setAttribute('content', previousRobots);
      }
    };
  }, [active, title]);
}
