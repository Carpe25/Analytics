# Deployment & Scheduled Cron Guide

## 1. Hosting Requirements

- **Runtime**: Node.js 18+ or 20+
- **Framework**: Next.js 14 App Router
- **Storage**:
  - For serverless deployments (Vercel, AWS Lambda, Cloudflare Pages): Use **S3 Object Storage** (AWS S3, Cloudflare R2, MinIO).
  - For persistent containers / Linux VPS: Either local persistent volume or S3.

---

## 2. Environment Variables Checklist for Production

Configure the following environment variables in your deployment dashboard:

```env
APP_BASE_URL=https://analytics.yourcompany.com
APP_TIMEZONE=Asia/Kolkata

# Google Sheets
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT_EMAIL=time-analytics-sync-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GitHub
GITHUB_AUTH_MODE=token
GITHUB_TOKEN=github_pat_...

# Storage (e.g. AWS S3 or Cloudflare R2)
ARTIFACT_STORAGE_PROVIDER=s3
ARTIFACT_STORAGE_BUCKET=time-analytics-snapshots
ARTIFACT_STORAGE_REGION=us-east-1
ARTIFACT_STORAGE_ACCESS_KEY=AKIA...
ARTIFACT_STORAGE_SECRET_KEY=wJalr...

# Scheduled Sync Secret
CRON_SECRET=generate-a-strong-random-token-here

# Optional Manual Sync Protection
MANUAL_SYNC_SECRET=
```

---

## 3. Configuring the Nightly Cron Job

The required schedule is **11:59 PM Asia/Kolkata** every day.
Since `Asia/Kolkata` is UTC+5:30 (and does not observe Daylight Saving Time), 11:59 PM IST corresponds to **18:29 UTC**.

Cron expression in UTC:
```cron
29 18 * * *
```

### Option A: Vercel Cron
Add a `vercel.json` file:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "29 18 * * *"
    }
  ]
}
```

### Option B: GitHub Actions Cron Trigger
Create `.github/workflows/nightly-sync.yml`:
```yaml
name: Nightly Sync
on:
  schedule:
    - cron: '29 18 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST "https://analytics.yourcompany.com/api/cron/sync" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### Option C: System Crontab (Linux Server)
```bash
crontab -e
# Add line:
29 18 * * * curl -s -X POST https://analytics.yourcompany.com/api/cron/sync -H "Authorization: Bearer <CRON_SECRET>" > /dev/null
```
