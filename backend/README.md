# Integrator Store backend

Backend for the Integrator (Connector) Store. A scheduled job syncs Ballerina Central, validates the data and publishes an immutable snapshot. A read-only GraphQL service serves that snapshot to the store UI.

## Layout

| Path | Purpose |
|------|---------|
| `service/` | Ballerina package `wso2/integrator_store_backend`. Read-only GraphQL API (`POST /`, root path, port 8090). Deployed as a Choreo component (`service/.choreo/component.yaml`). |
| `scheduler/` | Ballerina package `wso2/integrator_store_scheduler`. Scheduled sync from Ballerina Central, validation and snapshot publication. |
| `db/` | Database schema (`schema.sql`, placeholder). |

End-to-end tests live in `../e2e` (fake Central, backend, UI).

## Build and test

Requires Ballerina 2201.14.1.

```bash
cd service   && bal build && bal test
cd scheduler && bal build && bal test
```

## Status

Early development. The `snapshot` query returns data written by the scheduler to a local SQLite file. The other resolvers and the sync, enrichment and publication modules are not implemented yet.
