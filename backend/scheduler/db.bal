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
    string url = string `jdbc:postgresql://${dbHost}:${dbPort}/${dbName}?sslmode=require`;
    return new (url, dbUser, dbPassword);
}

function createTables(jdbc:Client db) returns sql:Error? {
    _ = check db->execute(`CREATE TABLE IF NOT EXISTS connectivity_check (
        id BIGSERIAL PRIMARY KEY,
        written_at TEXT NOT NULL
    )`);
}

function writeHeartbeat(jdbc:Client db) returns sql:Error? {
    string now = time:utcToString(time:utcNow());
    _ = check db->execute(`INSERT INTO connectivity_check (written_at) VALUES (${now})`);
}

// Returns the number of rows and the most recent timestamp, read back from the database.
function readHeartbeat(jdbc:Client db) returns [int, string]|sql:Error {
    int count = check db->queryRow(`SELECT count(*) FROM connectivity_check`);
    string latest = check db->queryRow(`SELECT written_at FROM connectivity_check ORDER BY id DESC LIMIT 1`);
    return [count, latest];
}
