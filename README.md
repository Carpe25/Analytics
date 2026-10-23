# Project Time Analytics — Google Sheets + GitHub, Database-Free MVP

> A web application that consolidates developer work logs maintained in Google Sheets and displays detailed project, developer, and category analytics alongside connected GitHub commit activity — entirely **database-free**.

---

## Key Features

- **Database-Free Architecture**: Serves synchronized analytics from durable JSON artifacts with atomic writes and schema validation.
- **Strict Two-Color Monochrome Design**: Built strictly using `#17212B` (primary dark) and `#F5F7F8` (light background) with the Inter font.
- **Dual Sync Mechanism**:
  - Scheduled nightly reconciliation at **11:59 PM Asia/Kolkata** (18:29 UTC).
  - Manual on-demand sync via the **"Sync Google Sheets now"** button.
- **Multi-Tab & Multi-Sheet Support**: Read logs from multiple developer tabs within one workbook or across separate workbooks.
- **Project & GitHub Mapping**: Connect one or more GitHub repositories to each project directly from the UI and view commit history separately from work hours.
- **Rich Analytics & Drill-Downs**: Project breakdowns, developer summaries, dynamic categories, developer × category matrix, and CSV exports.

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env.local
```
*(By default, `.env.local` runs with the local filesystem storage adapter in `.artifacts/` without needing cloud credentials for initial review).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Test Suite
```bash
npm test
```

### 5. Production Build
```bash
npm run build
npm start
```

---

## Where to Connect GitHub from the UI for Each Project

You can connect GitHub repositories to your projects directly from the interface:
1. Navigate to **Settings / Integrations** (`/settings`) from the sidebar.
2. In the **Project & GitHub Repositories** section, click **Connect GitHub Repository** (or **Link Repo** next to any project).
3. Enter the **GitHub Owner / Org** (e.g. `facebook`), **Repository Name** (e.g. `react`), and default branch (`main`).
4. Click **Test Connection** to immediately verify your `GITHUB_TOKEN` has read permissions.
5. Click **Save & Connect**. The mapping is saved to durable storage and will sync automatically!
*(You can also connect repositories directly on any individual project details page under `/projects/[projectId]`)*.

---

## Documentation Index

- [Google Sheets Setup Guide](docs/GOOGLE_SHEETS_SETUP.md)
- [GitHub Setup & Repo Connection Guide](docs/GITHUB_SETUP.md)
- [Synchronization Architecture & No-Database Storage](docs/SYNC_ARCHITECTURE.md)
- [Deployment & Cron Schedule Guide](docs/DEPLOYMENT.md)
- [Operations, Monitoring & Troubleshooting](docs/OPERATIONS.md)
- [Full Project Specification](PROJECT_SPEC.md)
