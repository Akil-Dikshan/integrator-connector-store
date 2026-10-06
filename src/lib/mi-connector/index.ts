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

/**
 * MI Integration Store API
 */
const MI_CONNECTOR_API_BASE =
  'https://apis.wso2.com/qgpf/connector-store-backend/endpoint-9090-803/v1.0';

/**
 * Package names (lowercase) that may fall back to a whole-word match on the MI
 * connector name when neither the exact-name nor the id-suffix lookup finds
 * anything. Empty by default: add a name here only after checking that the
 * connector it resolves to is the right one. Mutable so tests can add entries.
 */
export const WHOLE_WORD_FALLBACK_ALLOWLIST = new Set<string>();

/**
 * Explicit package-name -> MI connector-name aliases (lowercase keys), checked
 * after the exact/id lookups and before the whole-word fallback. "crypto" is a
 * prefix of "Cryptography", not a whole word, so the whole-word allowlist
 * cannot cover it. Add an entry only after checking the connector is the right one.
 */
const MI_CONNECTOR_ALIASES: Record<string, string> = {
  crypto: 'Cryptography',
};

/**
 * documentationUrl values that are not a connector-specific page: the MI docs
 * home (host mi.docs.wso2.com with at most an /en/<version> path, e.g.
 * /en/4.4.0 or /en/latest) and the Identity Server outbound-auth repos.
 */
const MI_DOCS_HOST = 'mi.docs.wso2.com';
const MI_DOCS_HOME_PATH = /^(\/en(\/[^/]+)?)?$/;
const IGNORED_DOC_URL_PATTERNS = [/wso2-extensions\/identity-outbound-auth-/i];

interface MIConnector {
  id: string;
  name: string;
}

interface MIConnectorDetails {
  id: string;
  name: string;
  documentationUrl?: string;
}

/** True if `word` appears in `text` as a whole word (not inside a longer word). */
function containsWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
}

/** True if the URL is the MI docs home (any version); query, hash and trailing slashes are ignored. */
function isMiDocsHome(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.hostname.toLowerCase() === MI_DOCS_HOST &&
      MI_DOCS_HOME_PATH.test(parsed.pathname.replace(/\/+$/, '').toLowerCase())
    );
  } catch {
    return false;
  }
}

/** Returns the URL, or undefined if it is the MI docs home or an identity-outbound-auth repo. */
function usableDocumentationUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (isMiDocsHome(url)) return undefined;
  if (IGNORED_DOC_URL_PATTERNS.some((pattern) => pattern.test(url))) return undefined;
  return url;
}

/**
 * Search for a matching MI connector by name
 * @param connectorName - The connector name to search for (e.g., "snowflake")
 * @returns The matching MI connector details with documentation URL, or null if not found
 */
export async function fetchMIConnector(connectorName: string): Promise<MIConnectorDetails | null> {
  try {
    // Step 1: Fetch all connector names
    const namesResponse = await fetch(`${MI_CONNECTOR_API_BASE}/connectors/names`);
    if (!namesResponse.ok) {
      console.warn('Failed to fetch MI connector names:', namesResponse.status);
      return null;
    }

    const connectors: MIConnector[] = await namesResponse.json();

    // Step 2: Search for matching connector with two-step lookup
    // First try exact match (trimmed, case-insensitive)
    const trimmedSearchName = connectorName.trim().toLowerCase();

    // Return early if search name is empty
    if (!trimmedSearchName) {
      return null;
    }

    let matchingConnector = connectors.find(
      (c) => c.name.trim().toLowerCase() === trimmedSearchName
    );

    // Fall back to id suffix match if exact name match fails
    if (!matchingConnector) {
      matchingConnector = connectors.find((c) =>
        c.id.toLowerCase().endsWith(`-${trimmedSearchName}`)
      );
    }

    // Explicit alias (e.g. crypto -> Cryptography)
    const aliasName = MI_CONNECTOR_ALIASES[trimmedSearchName]?.toLowerCase();
    if (!matchingConnector && aliasName) {
      matchingConnector = connectors.find((c) => c.name.trim().toLowerCase() === aliasName);
    }

    // Last resort: whole-word name match, only for explicitly allowlisted names.
    // (A plain substring match linked e.g. "io" to "Challenge Questions Connector".)
    if (!matchingConnector && WHOLE_WORD_FALLBACK_ALLOWLIST.has(trimmedSearchName)) {
      matchingConnector = connectors.find((c) => containsWholeWord(c.name, trimmedSearchName));
    }

    if (!matchingConnector) {
      return null;
    }

    // Step 3: Fetch full connector details to get documentation URL
    const detailsResponse = await fetch(
      `${MI_CONNECTOR_API_BASE}/connectors/${encodeURIComponent(matchingConnector.id)}`
    );
    if (!detailsResponse.ok) {
      console.warn('Failed to fetch MI connector details:', detailsResponse.status);
      return null;
    }

    const details: MIConnectorDetails = await detailsResponse.json();
    return { ...details, documentationUrl: usableDocumentationUrl(details.documentationUrl) };
  } catch (error) {
    console.error('Error fetching MI connector:', error);
    return null;
  }
}
