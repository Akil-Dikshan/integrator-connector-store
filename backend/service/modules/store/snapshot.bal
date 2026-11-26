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

# Reads the latest row and the row count from the shared database. Called once at start.
#
# + host - host name of the PostgreSQL server
# + port - port of the PostgreSQL server
# + database - name of the database
# + user - user name
# + password - password
# + return - the summary, or an error if the connection fails or the table is missing
public function load(string host, int port, string database, string user, string password)
        returns Summary|error {
    string url = string `jdbc:postgresql://${host}:${port}/${database}?sslmode=require`;
    jdbc:Client db = check new (url, user, password);
    record {|int id; string written_at;|} latest =
        check db->queryRow(`SELECT id, written_at FROM connectivity_check ORDER BY id DESC LIMIT 1`);
    int rows = check db->queryRow(`SELECT count(*) FROM connectivity_check`);
    check db.close();
    return {
        snapshotId: latest.id.toString(),
        lastSyncAt: latest.written_at,
        connectorCount: rows
    };
}
