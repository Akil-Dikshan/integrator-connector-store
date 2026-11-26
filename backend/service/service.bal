// Copyright (c) 2026 WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/graphql;
import integrator_store_backend.store;

// Snapshot summary, loaded once at startup.
final store:Summary summary = check store:load(dbHost, dbPort, dbName, dbUser, dbPassword);

service schema on new graphql:Listener(servicePort) {
    resource function get searchConnectors(string? query, string? area, string? vendor, string[]? orgs, Profile? profile, ConnectorSort? sort, boolean? includeDeprecated = false, int? 'limit = 30, int? offset = 0) returns ConnectorSearchResult {
        panic error("not implemented");
    }

    resource function get getConnector(string org, string name, string? version) returns Connector? {
        panic error("not implemented");
    }

    resource function get searchTriggers(string? query, TriggerType? 'type, int? 'limit = 30, int? offset = 0) returns TriggerSearchResult {
        panic error("not implemented");
    }

    resource function get facets(string? query, string? area, string? vendor, string[]? orgs) returns FacetResult {
        panic error("not implemented");
    }

    resource function get snapshot() returns SnapshotInfo {
        return new SnapshotInfo(summary.snapshotId, summary.lastSyncAt, summary.connectorCount);
    }
}
