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

/**
 * Thrown when Ballerina Central answers 404 for a package (or one of its versions).
 * It is a definite answer, not a glitch, so retrying it only delays the "not found"
 * page. Kept in its own module so UI code can import it without pulling in the
 * whole REST client.
 */
export class PackageNotFoundError extends Error {
  readonly notFound = true;

  constructor(message: string) {
    super(message);
    this.name = 'PackageNotFoundError';
    // Keeps `instanceof` working when compiled to older targets.
    Object.setPrototypeOf(this, PackageNotFoundError.prototype);
  }
}

export function isNotFoundError(error: unknown): error is PackageNotFoundError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { notFound?: unknown }).notFound === true
  );
}
