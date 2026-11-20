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

import ballerina/sql;
import ballerina/time;
import ballerinax/java.jdbc;

function openDb() returns jdbc:Client|sql:Error {
    return new ("jdbc:sqlite:" + dbPath);
}

function createTables(jdbc:Client db) returns sql:Error? {
    _ = check db->execute(`CREATE TABLE IF NOT EXISTS heartbeat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        written_at TEXT NOT NULL
    )`);
    // Full-text index over package name and description.
    _ = check db->execute(`CREATE VIRTUAL TABLE IF NOT EXISTS fts_check USING fts5(name, description)`);
}

// Writes a heartbeat row and refreshes the sample full-text rows. Not atomic.
function writeHeartbeat(jdbc:Client db) returns sql:Error? {
    string now = time:utcToString(time:utcNow());
    _ = check db->execute(`INSERT INTO heartbeat (written_at) VALUES (${now})`);
    _ = check db->execute(`DELETE FROM fts_check`);
    _ = check db->execute(`INSERT INTO fts_check (name, description) VALUES ('ballerina/http', 'HTTP client and server')`);
    _ = check db->execute(`INSERT INTO fts_check (name, description) VALUES ('ballerinax/kafka', 'Kafka producer and consumer')`);
}
