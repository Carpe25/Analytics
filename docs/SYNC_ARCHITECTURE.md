# Synchronization Architecture & No-Database Storage

## 1. Architectural Philosophy

Project Time Analytics deliberately operates **without a database**:
1. **Google Sheets is the source of truth** for all work logs.
2. **GitHub REST API is the source of truth** for repository commit records.
3. Durable artifacts are stored as versioned JSON snapshots (`analytics/latest.json`) using an interchangeable storage adapter.

---

## 2. The 14-Step Synchronization Pipeline

The same synchronization orchestrator (`src/lib/sync/orchestrator.ts`) powers both **scheduled nightly runs** and **manual syncs**:

1. **Acquire Sync Lock**: Writes atomic lock file (`sync/lock.json` or S3 object) with a TTL to prevent overlapping runs.
2. **Initialize Sync Run**: Creates a unique `runId` with trigger type (`scheduled` or `manual`) and timestamp.
3. **Load Configuration**: Reads project mappings, sheet tabs, and GitHub repositories from non-database storage (`settings.json`).
4. **Fetch Google Sheets**: Queries configured spreadsheet files and tabs using Google Sheets API v4.
5. **Normalize Work Logs**: Standardizes dates to `YYYY-MM-DD`, converts durations into integer minutes, normalizes project codes and aliases, and assigns stable composite IDs.
6. **Rejection & Duplicate Tracking**: Filters out empty rows, logs validation errors for invalid rows, and deduplicates identical reads.
7. **Fetch GitHub Commits**: Pulls commits for each project's connected repositories within the configured window (`GITHUB_INITIAL_IMPORT_DAYS`).
8. **Compute Aggregations**: Calculates totals for projects, developers, categories, and matrices.
9. **Assemble Snapshot**: Formats a versioned `AnalyticsSnapshot` object according to Zod schema.
10. **Write Temporary Artifact**: Validates JSON formatting and schema integrity.
11. **Atomically Publish**: Writes `analytics/latest.json` (and optional daily snapshot `analytics/snapshots/YYYY-MM-DD.json`).
12. **Append Sync History**: Writes the sync execution record to `sync/history.jsonl`.
13. **Release Sync Lock**: Removes the active lock file.
14. **Preserve Last Known Good State**: If Google Sheets read fails completely, the orchestrator records the failure in history but **preserves the prior valid snapshot**, ensuring zero downtime for dashboard viewers.

---

## 3. Storage Adapters

Implemented in `src/lib/storage/`:
- **Local Filesystem Adapter (`LocalArtifactStorage`)**: Stores artifacts in `.artifacts/` locally. Ideal for development and testing. Uses atomic rename (`write temp file -> rename`).
- **Object Storage Adapter (`S3ArtifactStorage`)**: Compatible with AWS S3, Cloudflare R2, MinIO, or Google Cloud Storage (S3-compatible API). Ideal for serverless and cloud deployments where local disk is ephemeral.
