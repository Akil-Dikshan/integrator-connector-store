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

import { fetchMIConnector, WHOLE_WORD_FALLBACK_ALLOWLIST } from './index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Connector names are SYNTHETIC test data, not a copy of the MI backend. The first
// three pairs mirror the false positives reported in the issue (io, os, box).
const CONNECTORS = [
  { id: 'mi-connector-challengequestions', name: 'Challenge Questions Connector' },
  { id: 'mi-connector-fhirrepository', name: 'FHIR Repository' },
  { id: 'mi-connector-dropbox', name: 'Dropbox' },
  { id: 'mi-connector-snowflake', name: 'Snowflake' },
  { id: 'mi-connector-salesforce', name: 'Salesforce Connector' },
  { id: 'mi-connector-awss3', name: 'AWS S3 (Beta)' },
  { id: 'mi-connector-cryptography', name: 'Cryptography' },
  { id: 'mi-connector-identityworkflowconnector', name: 'Workflow Connector' },
  { id: 'mi-connector-linkedinauth', name: 'LinkedIn' },
];

/** Mock the two MI endpoints: the name list, then the details of whichever id is asked for. */
function mockMiApi(documentationUrl?: string) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.endsWith('/connectors/names')) {
      return { ok: true, status: 200, json: async () => CONNECTORS };
    }
    const id = decodeURIComponent(url.split('/connectors/')[1]);
    const connector = CONNECTORS.find((c) => c.id === id);
    return {
      ok: !!connector,
      status: connector ? 200 : 404,
      json: async () => ({ ...connector, documentationUrl }),
    };
  });
}

const detailCalls = () =>
  mockFetch.mock.calls.filter(([url]) => !(url as string).endsWith('/connectors/names'));

describe('fetchMIConnector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    WHOLE_WORD_FALLBACK_ALLOWLIST.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exact and id-suffix matching (unchanged)', () => {
    it('matches an exact name, ignoring case and surrounding whitespace', async () => {
      mockMiApi('https://mi.docs.wso2.com/en/latest/reference/connectors/snowflake/');
      const result = await fetchMIConnector('  SNOWFLAKE ');
      expect(result?.id).toBe('mi-connector-snowflake');
      expect(result?.documentationUrl).toBe(
        'https://mi.docs.wso2.com/en/latest/reference/connectors/snowflake/'
      );
    });

    it('matches on the id suffix when the name differs', async () => {
      mockMiApi('https://example.com/docs/salesforce');
      const result = await fetchMIConnector('salesforce');
      expect(result?.id).toBe('mi-connector-salesforce');
    });

    it('returns null for an empty name without calling the API for details', async () => {
      mockMiApi();
      expect(await fetchMIConnector('   ')).toBeNull();
      expect(detailCalls()).toHaveLength(0);
    });
  });

  describe('substring false positives', () => {
    it.each([
      ['io', 'Challenge Questions Connector'],
      ['os', 'FHIR Repository'],
      ['box', 'Dropbox'],
      ['flake', 'Snowflake'],
      ['s3', 'AWS S3 (Beta)'],
    ])('does not link "%s" to "%s"', async (packageName) => {
      mockMiApi('https://example.com/docs');
      expect(await fetchMIConnector(packageName)).toBeNull();
      // Never even requested a connector's details
      expect(detailCalls()).toHaveLength(0);
    });

    it('still does not substring-match when the name is allowlisted', async () => {
      WHOLE_WORD_FALLBACK_ALLOWLIST.add('box');
      mockMiApi('https://example.com/docs');
      expect(await fetchMIConnector('box')).toBeNull();
    });
  });

  describe('whole-word fallback (allowlisted names only)', () => {
    it('matches an allowlisted name that is a whole word in the connector name', async () => {
      WHOLE_WORD_FALLBACK_ALLOWLIST.add('s3');
      mockMiApi('https://example.com/docs/s3');
      const result = await fetchMIConnector('S3');
      expect(result?.id).toBe('mi-connector-awss3');
    });

    it('does not use the fallback for a name that is not allowlisted', async () => {
      mockMiApi('https://example.com/docs/s3');
      expect(await fetchMIConnector('s3')).toBeNull();
    });

    it('does not match when the allowlisted name only appears inside a longer word', async () => {
      WHOLE_WORD_FALLBACK_ALLOWLIST.add('io');
      mockMiApi('https://example.com/docs');
      expect(await fetchMIConnector('io')).toBeNull();
    });

    it('treats regex characters in the name literally', async () => {
      WHOLE_WORD_FALLBACK_ALLOWLIST.add('a.s');
      CONNECTORS.push({ id: 'mi-connector-x', name: 'Axs Connector' });
      try {
        mockMiApi('https://example.com/docs');
        // "a.s" as a regex would match "Axs"; as a literal it must not
        expect(await fetchMIConnector('a.s')).toBeNull();
      } finally {
        CONNECTORS.pop();
      }
    });
  });

  describe('documentationUrl filter', () => {
    it.each([
      ['https://mi.docs.wso2.com'],
      ['https://mi.docs.wso2.com/'],
      ['https://mi.docs.wso2.com/en/latest/'],
      ['https://mi.docs.wso2.com/en/4.4.0/'],
      ['https://mi.docs.wso2.com/en/4.4.0'],
      ['HTTPS://MI.DOCS.WSO2.COM/en/latest?x=1#top'],
      ['https://github.com/wso2-extensions/identity-outbound-auth-oidc'],
      [
        'https://github.com/wso2-extensions/identity-outbound-auth-linkedIn/blob/master/docs/README.md',
      ],
      ['https://github.com/wso2-extensions/identity-outbound-auth-sms-otp/blob/master/README.md'],
    ])('drops %s', async (url) => {
      mockMiApi(url);
      const result = await fetchMIConnector('snowflake');
      // The connector is still found, but its unusable link is removed
      expect(result?.id).toBe('mi-connector-snowflake');
      expect(result?.documentationUrl).toBeUndefined();
    });

    it.each([
      ['https://mi.docs.wso2.com/en/latest/reference/connectors/snowflake-connector/'],
      ['https://github.com/wso2-extensions/mediation-snowflake-connector'],
      [
        'https://mi.docs.wso2.com/en/latest/reference/connectors/salesforce-connectors/sf-overview/',
      ],
      ['https://mi.docs.wso2.com/en/4.4.0/reference/connectors/snowflake-connector/'],
    ])('keeps %s', async (url) => {
      mockMiApi(url);
      const result = await fetchMIConnector('snowflake');
      expect(result?.documentationUrl).toBe(url);
    });
  });

  describe('explicit alias', () => {
    it('links "crypto" to the Cryptography connector and keeps its docs page', async () => {
      const url =
        'https://mi.docs.wso2.com/en/latest/reference/connectors/cryptography-module/cryptography-module-overview/';
      mockMiApi(url);
      const result = await fetchMIConnector('crypto');
      expect(result?.id).toBe('mi-connector-cryptography');
      expect(result?.documentationUrl).toBe(url);
    });

    it('does not link "workflow" to the Identity Server Workflow Connector', async () => {
      mockMiApi(
        'https://github.com/wso2-extensions/identity-workflow-impl-bps/blob/master/docs/config.md'
      );
      expect(await fetchMIConnector('workflow')).toBeNull();
      expect(detailCalls()).toHaveLength(0);
    });

    it('does not link "edi" to LinkedIn', async () => {
      mockMiApi('https://example.com/docs');
      expect(await fetchMIConnector('edi')).toBeNull();
    });
  });

  describe('failures', () => {
    it('returns null when the names request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => [] });
      expect(await fetchMIConnector('snowflake')).toBeNull();
    });

    it('returns null when the details request fails', async () => {
      mockFetch.mockImplementation(async (url: string) =>
        url.endsWith('/connectors/names')
          ? { ok: true, status: 200, json: async () => CONNECTORS }
          : { ok: false, status: 500, json: async () => ({}) }
      );
      expect(await fetchMIConnector('snowflake')).toBeNull();
    });
  });
});
