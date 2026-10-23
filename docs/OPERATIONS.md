# Operations & Troubleshooting Guide

## 1. Monitoring Sync Health

1. **Dashboard Compact Indicator**: The sidebar displays the current snapshot state and the exact timestamp of the last successful synchronization in `Asia/Kolkata`.
2. **Health Endpoint (`GET /api/health`)**:
   Returns JSON indicating whether server credentials are present and whether a valid snapshot is currently served:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-10-23T15:00:00.000Z",
     "config": {
       "google": { "configured": true, "mode": "service_account" },
       "github": { "configured": true, "tokenPresent": true },
       "storage": { "configured": true, "provider": "local" }
     },
     "storage": {
       "hasLatestSnapshot": true,
       "lastSuccessfulSyncAtUtc": "2026-10-23T14:30:00.000Z"
     }
   }
   ```
3. **Sync History Audit Trail (`/sync-history`)**:
   Provides detailed run metrics: start/end timestamps, duration, rows accepted, rows rejected, commits synced, and error traces.

---

## 2. Troubleshooting Common Issues

### Issue 1: "The caller does not have permission" (Google Sheets API)
- **Cause**: The spreadsheet has not been shared with the service account email.
- **Solution**: Open the spreadsheet in Google Sheets, click **Share**, paste your `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and grant **Viewer** permissions.

### Issue 2: "Another synchronization run is currently active"
- **Cause**: A previous sync did not release its lock file, or another run is in progress.
- **Solution**: The lock automatically expires after 10 minutes (TTL = 600s). For immediate resolution in local mode, delete `.artifacts/sync/lock.json` (or `sync/lock.json` in your S3 bucket).

### Issue 3: GitHub 404 Not Found on Repository Access
- **Cause**: The token lacks permission to view private repositories, or the repository name/owner was mistyped.
- **Solution**: Go to `/settings`, verify the owner/repo casing, and test the repository connection using the **Test Connection** button. Ensure fine-grained tokens have *Contents: Read* permission on that repository.

### Issue 4: "No synchronized analytics snapshot available yet"
- **Cause**: The application was just deployed and no sync has run yet.
- **Solution**: Click the **Sync Google Sheets now** button in the top navigation or trigger `POST /api/sync`.
