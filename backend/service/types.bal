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

type schema service object {
    *graphql:Service;
    resource function get searchConnectors(string? query, string? area, string? vendor, string[]? orgs, Profile? profile, ConnectorSort? sort, boolean? includeDeprecated = false, int? 'limit = 30, int? offset = 0) returns ConnectorSearchResult;
    resource function get getConnector(string org, string name, string? version) returns Connector?;
    resource function get searchTriggers(string? query, TriggerType? 'type, int? 'limit = 30, int? offset = 0) returns TriggerSearchResult;
    resource function get facets(string? query, string? area, string? vendor, string[]? orgs) returns FacetResult;
    resource function get snapshot() returns SnapshotInfo;
};

public enum ConnectorSort {
    RELEVANCE,
    POPULARITY,
    NAME,
    UPDATED
}

public enum Profile {
    INTEGRATOR,
    MI
}

public enum TriggerType {
    HTTP,
    GRAPHQL,
    TCP,
    FILE,
    EVENT,
    AGENT,
    MCP
}

public distinct service class Area {
    resource function get name() returns string {
        panic error("not implemented");
    }

    resource function get connectorCount() returns int {
        panic error("not implemented");
    }
}

public distinct service class Connector {
    resource function get id() returns @graphql:ID string {
        panic error("not implemented");
    }

    resource function get org() returns string {
        panic error("not implemented");
    }

    resource function get name() returns string {
        panic error("not implemented");
    }

    resource function get displayName() returns string {
        panic error("not implemented");
    }

    resource function get latestVersion() returns string? {
        panic error("not implemented");
    }

    resource function get versions() returns string[] {
        panic error("not implemented");
    }

    resource function get description() returns string {
        panic error("not implemented");
    }

    resource function get icon() returns string? {
        panic error("not implemented");
    }

    resource function get license() returns string? {
        panic error("not implemented");
    }

    resource function get sourceRepo() returns string? {
        panic error("not implemented");
    }

    resource function get repoUrl() returns string? {
        panic error("not implemented");
    }

    resource function get docsUrl() returns string? {
        panic error("not implemented");
    }

    resource function get totalPullCount() returns int? {
        panic error("not implemented");
    }

    resource function get areas() returns string[] {
        panic error("not implemented");
    }

    resource function get vendor() returns string? {
        panic error("not implemented");
    }

    resource function get profiles() returns Profile[] {
        panic error("not implemented");
    }

    resource function get miComponents() returns MIComponent[] {
        panic error("not implemented");
    }

    resource function get isDeprecated() returns boolean {
        panic error("not implemented");
    }

    resource function get updatedAt() returns string {
        panic error("not implemented");
    }
}

public distinct service class ConnectorSearchResult {
    resource function get count() returns int {
        panic error("not implemented");
    }

    resource function get connectors() returns Connector[] {
        panic error("not implemented");
    }
}

public distinct service class FacetResult {
    resource function get areas() returns Area[] {
        panic error("not implemented");
    }

    resource function get vendors() returns Vendor[] {
        panic error("not implemented");
    }

    resource function get profiles() returns ProfileCount[] {
        panic error("not implemented");
    }
}

public distinct service class MIAsset {
    resource function get name() returns string? {
        panic error("not implemented");
    }

    resource function get downloadUrl() returns string? {
        panic error("not implemented");
    }
}

public distinct service class MIComponent {
    resource function get id() returns @graphql:ID string {
        panic error("not implemented");
    }

    resource function get name() returns string {
        panic error("not implemented");
    }

    resource function get description() returns string? {
        panic error("not implemented");
    }

    resource function get license() returns string? {
        panic error("not implemented");
    }

    resource function get licenseUrl() returns string? {
        panic error("not implemented");
    }

    resource function get labels() returns string[] {
        panic error("not implemented");
    }

    resource function get repoUrl() returns string? {
        panic error("not implemented");
    }

    resource function get documentationUrl() returns string? {
        panic error("not implemented");
    }

    resource function get releases() returns MIRelease[] {
        panic error("not implemented");
    }
}

public distinct service class MIRelease {
    resource function get tagName() returns string? {
        panic error("not implemented");
    }

    resource function get name() returns string? {
        panic error("not implemented");
    }

    resource function get releaseUrl() returns string? {
        panic error("not implemented");
    }

    resource function get products() returns string[] {
        panic error("not implemented");
    }

    resource function get assets() returns MIAsset[] {
        panic error("not implemented");
    }
}

public distinct service class ProfileCount {
    resource function get profile() returns Profile {
        panic error("not implemented");
    }

    resource function get connectorCount() returns int {
        panic error("not implemented");
    }
}

public distinct service class SnapshotInfo {
    private final string id;
    private final string syncedAt;
    private final int connectors;

    function init(string id, string syncedAt, int connectors) {
        self.id = id;
        self.syncedAt = syncedAt;
        self.connectors = connectors;
    }

    resource function get snapshotId() returns string {
        return self.id;
    }

    resource function get lastSyncAt() returns string {
        return self.syncedAt;
    }

    resource function get stale() returns boolean {
        return false;
    }

    resource function get connectorCount() returns int {
        return self.connectors;
    }

    resource function get triggerCount() returns int {
        return 0;
    }
}

public distinct service class Trigger {
    resource function get id() returns @graphql:ID string {
        panic error("not implemented");
    }

    resource function get org() returns string {
        panic error("not implemented");
    }

    resource function get name() returns string {
        panic error("not implemented");
    }

    resource function get connector() returns Connector? {
        panic error("not implemented");
    }

    resource function get moduleName() returns string {
        panic error("not implemented");
    }

    resource function get displayName() returns string {
        panic error("not implemented");
    }

    resource function get version() returns string {
        panic error("not implemented");
    }

    resource function get 'type() returns TriggerType {
        panic error("not implemented");
    }

    resource function get listenerProtocol() returns string? {
        panic error("not implemented");
    }

    resource function get documentation() returns string? {
        panic error("not implemented");
    }

    resource function get icon() returns string? {
        panic error("not implemented");
    }

    resource function get totalPullCount() returns int? {
        panic error("not implemented");
    }

    resource function get isDeprecated() returns boolean {
        panic error("not implemented");
    }

    resource function get updatedAt() returns string {
        panic error("not implemented");
    }
}

public distinct service class TriggerSearchResult {
    resource function get count() returns int {
        panic error("not implemented");
    }

    resource function get triggers() returns Trigger[] {
        panic error("not implemented");
    }
}

public distinct service class Vendor {
    resource function get name() returns string {
        panic error("not implemented");
    }

    resource function get connectorCount() returns int {
        panic error("not implemented");
    }
}
