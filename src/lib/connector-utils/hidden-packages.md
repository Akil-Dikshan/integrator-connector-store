# Hidden packages

Packages in the hidden list are kept out of the store listing and out of the generated sitemap.

## Format

The list is a flat JSON array of strings in [hidden-packages.json](./hidden-packages.json). That file is the source of truth. It is read by the app (`HIDDEN_PACKAGES` and `isHiddenPackage` in [connector-utils.ts](./connector-utils.ts)) and by `scripts/generate-sitemap.js`, so one edit applies to both.

Each entry is one of:

- a bare name, such as `sql`: hides the package with that name in every organization (for example both `ballerina/sql` and `ballerinax/sql`);
- an `org/name` pair, such as `ballerinax/salesforce`: hides that package in that organization only.

Matching is exact and case-sensitive. At the moment every entry is a bare name.

## Deprecated packages

[deprecated-packages.json](./deprecated-packages.json) holds packages whose newest version is deprecated in Ballerina Central. They are hidden the same way as entries in `hidden-packages.json` (both files are merged into `HIDDEN_PACKAGES` and the sitemap script's list).

- Entries are `org/name` only (for example `ballerina/regex`), never bare names.
- A later workflow will regenerate this file, so it holds only entries detected in Ballerina Central. Do not add manual entries here; put them in `hidden-packages.json`, or they will be overwritten.

## Adding or removing an entry

1. Edit [hidden-packages.json](./hidden-packages.json): add or delete the string.
2. Run the tests (`npm test`).
3. To check the sitemap, run `node scripts/generate-sitemap.js` and confirm the package is gone from `public/sitemap.xml`. The sitemap is generated at build time and is not committed.

## Notes

- `np` hides both `ballerina/np` and `ballerinax/np`, because it is a bare name. This is intentional for now; use `ballerina/np` or `ballerinax/np` to hide only one of them.
- `ballerina/regex` and `ballerina/xmldata` are hidden via the deprecated list. `ballerina/xmldata` is not flagged as deprecated on its newest version in Ballerina Central, so a regenerated list would drop it unless the owners flag it there.
- `googleapis.calendar` is not deprecated in Ballerina Central; it is hidden manually.
- `cdc` is hidden manually (not deprecated in Ballerina Central).
- `trigger.salesforce` is not in the Ballerina Central registry.
