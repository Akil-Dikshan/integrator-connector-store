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

// snapshot: immutable snapshot, atomic publish and last-good rollback, behind a store
// interface so that storage backends can be swapped.

import ballerinax/java.jdbc;

# Summary of the latest published snapshot.
public type Summary record {|
    string snapshotId;
    string lastSyncAt;
    int connectorCount;
|};

# Reads the latest heartbeat row and runs one FTS5 query. Called once at start.
#
# + dbPath - path of the SQLite file the scheduler writes
# + return - the summary, or an error if the file or tables are missing
public function load(string dbPath) returns Summary|error {
    jdbc:Client db = check new ("jdbc:sqlite:" + dbPath);
    record {|int id; string written_at;|} heartbeat =
        check db->queryRow(`SELECT id, written_at FROM heartbeat ORDER BY id DESC LIMIT 1`);
    int matches = check db->queryRow(`SELECT count(*) FROM fts_check WHERE fts_check MATCH 'http'`);
    check db.close();
    return {
        snapshotId: heartbeat.id.toString(),
        lastSyncAt: heartbeat.written_at,
        connectorCount: matches
    };
}
