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

// Runtime configuration. The defaults below are placeholders.

# Base URL of Ballerina Central's registry API.
configurable string centralUrl = "https://api.central.ballerina.io/2.0/registry";

# Port the GraphQL service listens on (matches .choreo/component.yaml).
configurable int servicePort = 8090;

# Seconds between sync runs.
configurable decimal syncIntervalSeconds = 3600;

# Percentage drop in package count that blocks publishing a new snapshot (placeholder).
configurable decimal dropThresholdPercent = 5.0;

# Host name of the PostgreSQL server that holds the snapshot.
configurable string dbHost = ?;

# Port of the PostgreSQL server.
configurable int dbPort = 5432;

# Name of the database to use.
configurable string dbName = ?;

# User name used to connect to the database.
configurable string dbUser = ?;

# Password used to connect to the database.
configurable string dbPassword = ?;
