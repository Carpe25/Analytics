# Project Specification & Antigravity Build Instructions

## Project Time Analytics --- Google Sheets + GitHub, Database-Free MVP

**Document purpose:** This is the complete implementation brief to give
Antigravity. Build the application described below, including the UI,
integrations, nightly synchronization, manual sync, analytics, error
handling, tests, and setup documentation.

------------------------------------------------------------------------

## 1. Mission and outcome

Build a polished web application that consolidates developer work logs
currently maintained in Google Sheets and displays detailed project,
developer, and category analytics. Also connect GitHub repositories to
projects and show commit activity.

### Non-negotiable product decisions

1.  **Do not use a database in this version.** No PostgreSQL, MySQL,
    SQLite, MongoDB, Prisma, Drizzle, ORM, or other database.
2.  **Google Sheets is the source of truth for work logs.** Developers
    continue entering and editing logs only in their existing Google
    Sheets. Do not require duplicate entry in the application.
3.  **Nightly synchronization is the default.** Run the sync at the end
    of each day using the `Asia/Kolkata` timezone. The dashboard shows
    the latest successfully synchronized report during the day.
4.  **Provide a "Sync Google Sheets now" button** so an authorized user
    can manually start a sync.
5.  **Keep GitHub data separate from hours.** GitHub commits are
    activity records and must never be treated as time worked or used to
    infer hours.
6.  **Use shadcn/ui** for interface components.
7.  **Use exactly two UI colors throughout** and **one font family
    throughout**. Do not introduce extra accent, status, chart, or
    decorative colors.
8.  Build a usable application, not only a mockup. Integrations must
    have real backend implementation, configuration instructions,
    loading/error states, and tests.
9.  Do not assume the exact structure of the user's Google Sheets. Build
    configurable sheet/column mapping and document what must be
    configured.
10. Do not invent credentials, spreadsheet IDs, repository names,
    category values, or production environment variables.

------------------------------------------------------------------------

## 2. Required behavior at a glance

-   Read logs from multiple developer-specific tabs in one Google
    spreadsheet **or** from multiple individual Google spreadsheet
    files.
-   Normalize the source rows into a common in-memory structure.
-   Calculate analytics across all projects, developers, categories, and
    dates.
-   Generate a report snapshot after each successful nightly sync.
-   Keep serving the last good snapshot if a new sync fails.
-   Allow authorized users to manually run a sync.
-   Show the sync status, last successful sync timestamp, duration,
    number of rows read/created/updated/ignored, and error details.
-   Maintain a sync activity history without a database.
-   Connect one or more GitHub repositories to a project.
-   Import initial commit history and subsequently fetch recent commits.
-   Show commit author, committer where available, timestamp, message,
    short SHA, branch/repository context where available, and link to
    the GitHub commit.
-   Provide filters and exports.
-   Include a clear setup guide for Google access, GitHub access,
    scheduled jobs, storage, local development, and deployment.

------------------------------------------------------------------------

## 3. Technology stack

Use the following stack unless the existing repository already has a
compatible stack. First inspect the repository and report the current
stack before changing anything.

### Frontend

-   Next.js with App Router
-   React
-   TypeScript with strict mode
-   Tailwind CSS
-   shadcn/ui
-   Lucide icons
-   Recharts for charts
-   Zod for validating configuration, API inputs, and normalized source
    records
-   One font family: **Inter**, applied globally to all text, buttons,
    inputs, charts, tables, dialogs, and navigation.

### Backend

-   Next.js Route Handlers / server-only modules for API endpoints and
    integrations.
-   Google Sheets API for reading sheet values.
-   GitHub REST API for repository and commit history.
-   A protected scheduled endpoint invoked by the deployment platform's
    cron facility or a system cron job.
-   A server-side synchronization service shared by the manual sync
    route and scheduled sync route.

### Persistence without a database

The application needs a durable way to serve the last successful report
and keep sync history, but must not use a database.

Implement a small storage adapter with a clear interface. Prefer a
configured **private object-storage bucket** for JSON artifacts, or a
configured private Google Drive application folder if object storage is
not available. The storage layer must persist: - `analytics/latest.json`
--- last successfully generated report snapshot. -
`analytics/snapshots/YYYY-MM-DD.json` --- optional daily snapshot, if
historical snapshots are enabled. - `sync/history.json` or JSON Lines
equivalent --- sync run history. - `sync/lock.json` or an equivalent
atomic lock mechanism to prevent concurrent runs, if supported by the
chosen storage provider.

Do not use an ephemeral serverless filesystem as durable storage. A
local filesystem adapter may be provided for local development only and
must be clearly marked as unsuitable for ephemeral/serverless production
deployment. If durable artifact storage is not configured, show a clear
setup error and do not falsely claim the report was saved.

**No database may be added as a shortcut for logs, cache, users,
mappings, commits, or analytics.** Store configuration in validated
environment variables and, where suitable, a version-controlled
non-secret configuration file. Store durable runtime artifacts only in
the non-database storage adapter. Keep secrets in environment variables
/ deployment secret manager.

### Tests and tooling

-   Vitest or the existing test runner
-   Playwright or the existing browser test framework for key UI flows
-   ESLint and TypeScript checks
-   npm/pnpm based on the repository's existing package manager; do not
    replace a lockfile unnecessarily.

------------------------------------------------------------------------

## 4. Strict visual design system

### Exactly two colors

Use these two color values as the only UI colors: - **Primary dark:**
`#17212B` - **Light background:** `#F5F7F8`

Use the dark color for primary text, icons, borders, primary buttons,
chart marks, focus indicators, and dark surfaces where needed. Use the
light color for page backgrounds, cards, inputs, table backgrounds,
dialogs, and contrasting text on dark buttons only where contrast
permits. For readable text on a light background, use the dark color.
For a dark surface, use the light color.

Do not introduce green/red/blue/yellow/orange/purple status colors,
gradients, colorful chart palettes, or extra hex colors. Status should
be communicated using text, icons, labels, and the same two colors.
Opacity/tints may be used only if they are generated from these two base
colors and do not introduce another hue. Do not use browser-default
colored focus rings.

### One font

Use **Inter only**. Remove or avoid secondary fonts, serif fonts, system
font stacks as explicit design choices, and icon fonts. Icons must be
SVG/Lucide icons, not emoji.

### UI principles

-   Professional, restrained, clean analytics dashboard.
-   Strong hierarchy, consistent spacing, subtle borders, readable data
    tables.
-   Avoid gradients, glassmorphism, excessive animation, decorative
    illustrations, and unnecessary cards.
-   Responsive from desktop to tablet and mobile.
-   Accessible labels, keyboard navigation, focus states, semantic HTML,
    sufficient contrast.
-   All charts must use the same two-color monochrome system. Do not use
    category-specific colors.
-   Use shadcn/ui components consistently: Button, Card, Badge, Tabs,
    Table, Select, Input, DropdownMenu, Dialog, Sheet, Tooltip,
    Skeleton, Alert, Separator, Calendar/Date picker where needed, and
    Toast/Sonner if compatible.
-   Provide dark/light styling only if it can be implemented using the
    same two color values. Do not add a third color for a separate
    theme.

------------------------------------------------------------------------

## 5. Information architecture and screens

### 5.1 Main navigation

Create a persistent left sidebar on desktop and responsive navigation on
smaller screens: - Overview - Projects - Developers - Categories -
GitHub Activity - Sync History - Settings / Integrations

Show the product name **Project Time Analytics** and a compact sync
status area.

### 5.2 Overview dashboard

Show: - Total hours in the currently selected reporting range - Number
of projects with logged work - Number of developers with logged work -
Number of work log entries - Last successful sync time and timezone -
Current sync status - "Sync Google Sheets now" primary action -
Project-hours chart - Developer-hours chart - Category-hours chart -
Recent work-log activity (based on latest snapshot) - Recent GitHub
commits - Filters for date range, project, developer, and category -
Export controls

Every displayed number must be computed from actual synchronized source
data. If there is no configured source, show a useful empty state, not
fabricated sample figures.

### 5.3 Projects list

Display each project found in the configured project mapping or source
records: - Project name and optional project code - Total hours - Number
of contributing developers - Work-log count - Connected GitHub
repositories - Latest commit timestamp - Last activity / latest log date

Include search, filters, sorting, and a project details link.

### 5.4 Project details

Tabs: 1. Summary 2. Work logs 3. Developer breakdown 4. Category
breakdown 5. Developer × category matrix 6. GitHub commits 7.
Sync/source details

Project summary must include: - Total hours for the selected date
range - Developer contribution chart/table - Category contribution
chart/table - Daily/weekly trend if enough data exists - Latest logs and
latest commits - Repository mapping and sync status

### 5.5 Developers

List developers with: - Canonical display name - Mapped source
sheet/tab/file - Mapped GitHub username(s), if configured - Total hours
across projects - Projects contributed to - Category totals - Latest
work date - Commit counts in the selected range, shown separately from
hours

Developer details should show project × category breakdown, work-log
details, and GitHub activity.

### 5.6 Categories

List categories discovered from configuration/source data: - Category
name - Total hours across all projects - Percentage of total hours -
Number of developers who logged time in the category - Projects where
the category was used

Do not assume category names in code. Categories are configured or
discovered from the sheets.

### 5.7 GitHub activity

Show a searchable/filterable commit table: - Commit message - Short SHA
with link to full commit - Repository - Project mapping - Author
name/login - Committer where available - Commit timestamp in
`Asia/Kolkata`, with original timestamp preserved - Branch/ref if
available from the event/history source - Author avatar only if safely
available from GitHub's public API; avatar is optional and may be
omitted to maintain the strict two-color design.

Filters: project, repository, author, date range. Add a link to open the
commit on GitHub.

### 5.8 Sync history

Display each sync run: - Run ID - Trigger type: scheduled or manual -
Start and finish timestamps - Duration - Status: success, partial,
failed, running - Source spreadsheets/files/tabs attempted - Rows read,
accepted, inserted into normalized output, updated, ignored, and
rejected - Number of commits fetched/updated - Warning/error summary -
Expandable technical details for admins

Use only the two design colors. Communicate status with text and icons,
not colored status badges.

### 5.9 Settings / Integrations

Sections: - Google Sheets configuration and connection check - Developer
sheet/file mapping - Column mapping - Project mapping - GitHub
connection and repository-to-project mapping - Scheduled sync status and
timezone - Artifact storage connection and status - Last successful sync
and "Test connection" controls

Never display secrets in the UI. Show only whether required
configuration is present.

------------------------------------------------------------------------

## 6. Google Sheets integration

### 6.1 Source-of-truth rule

Google Sheets remains the source of truth for developer work logs. The
application reads source data and does not write, edit, delete,
reformat, or reorder developer log rows. No two-way sync in this
version.

### 6.2 Supported layouts

Support both: 1. One spreadsheet with one worksheet/tab per developer.
2. Separate spreadsheet files for each developer.

Implement configuration so the user can specify spreadsheet IDs and tab
names. Do not assume a single workbook or one fixed sheet layout.

### 6.3 Column mapping

Create configurable mappings for: - Developer identity (may be inferred
from a configured tab/file mapping) - Project name or project code -
Work category - Work description - Hours/duration - Work date - Optional
log ID - Optional task/ticket ID - Optional created/updated timestamp -
Optional notes

Column names may differ from these labels. Support header-based mapping
and explicit column overrides. Trim whitespace carefully and preserve
meaningful description text.

### 6.4 Duration parsing

Support common formats only when unambiguous: - Decimal hours,
e.g. `1.5` = 90 minutes - `H:MM`, e.g. `1:30` = 90 minutes - Explicit
hour/minute fields if the source has separate columns - Optional
duration text such as `1h 30m`, if implemented with tests

Store duration in memory and snapshots as integer minutes. Display hours
with consistent formatting. Reject negative values, malformed values,
and implausible durations according to configurable validation rules. Do
not silently turn invalid values into zero.

### 6.5 Work-date rules

-   Use the date the work was performed, not the date the row was
    imported.
-   Parse spreadsheet date values according to documented spreadsheet
    behavior and configured timezone.
-   Normalize timestamps consistently and display times in
    `Asia/Kolkata`.
-   Include late-entered or edited old logs in the next successful sync
    while preserving their original work date.
-   Do not assume every row added since the last sync is a new work log;
    edits and sorting are possible.

### 6.6 Identity and project normalization

-   Maintain explicit mapping from source sheet/file to canonical
    developer identity where possible.
-   Map project names/codes to a canonical project identifier using a
    configuration file or integration settings artifact.
-   Normalize whitespace/case for matching only; preserve original
    values for troubleshooting.
-   Flag unknown developers, projects, and categories for review; do not
    silently merge different people or projects.
-   Provide an unmapped-record count and actionable warnings.

### 6.7 Duplicate detection and updates

Preferred identity: a stable `Log ID` column provided by the source
sheet. If no stable ID exists, use a documented composite-key strategy
and warn that it is less reliable. Do not use row number as the only
identifier because rows can be sorted or inserted. Deduplicate repeated
reads. When a source row is edited, the latest source value should
replace the corresponding normalized value in the newly generated
snapshot. If a source row disappears, reflect the source-of-truth
semantics in the latest snapshot, but do not erase older daily snapshots
if historical snapshots are enabled. Do not assume an append-only sheet.

### 6.8 Google authentication

Implement server-side Google authentication using the Google Sheets API.
Prefer a service account when the organization can explicitly share the
relevant spreadsheets with that service account. If the organization
uses another approved auth method, document it and implement the
appropriate server-side OAuth flow. - Never expose credentials or tokens
to browser code. - Never commit credentials to source control. -
Validate required environment variables on the server. - Provide a "Test
Google Sheets connection" action that checks read access without
changing any sheet. - Handle missing permissions, invalid spreadsheet
IDs, missing tabs, API quotas, timeouts, and malformed ranges with clear
actionable errors.

### 6.9 Google change notifications

The MVP does not need instant sync. The nightly scheduled sync is
authoritative. An optional Apps Script edit trigger may be added later,
but do not make the core architecture depend on a browser being open or
on a trigger that cannot reliably cover all edits. Nightly
reconciliation must always reread the configured source records or
otherwise reliably detect edits and deletions.

------------------------------------------------------------------------

## 7. Nightly synchronization architecture

### 7.1 Schedule

-   Default schedule: **11:59 PM Asia/Kolkata** every day.
-   Make the schedule configurable in deployment
    documentation/configuration.
-   Use the hosting provider's scheduled job feature or a system cron
    job to call a protected server-side endpoint.
-   Do not assume server timezone equals India time.
-   If the platform uses UTC-only cron schedules, calculate and document
    the correct UTC schedule and handle daylight-saving assumptions
    appropriately. `Asia/Kolkata` itself does not observe daylight
    saving time.
-   Record both UTC timestamps and display timezone-local timestamps.

### 7.2 Sync pipeline

1.  Acquire a lock or otherwise prevent overlapping sync runs.
2.  Create a sync run record with trigger type and start time.
3.  Validate configuration and artifact-storage connectivity.
4.  Fetch all configured spreadsheet files and tabs.
5.  Normalize and validate each row.
6.  Track accepted, ignored, duplicate, and rejected rows.
7.  Fetch GitHub commit updates for each configured repository.
8.  Calculate aggregate analytics.
9.  Write the new report artifact to a temporary/versioned object key.
10. Verify the written artifact can be read and parsed.
11. Atomically publish/update `analytics/latest.json` only after the new
    report is fully valid.
12. Save sync history and mark the run successful.
13. Release the lock.
14. If any critical step fails, preserve the previous good snapshot and
    record the failure. Do not replace the latest report with
    empty/partial data unless an explicit partial-success policy is
    configured and clearly communicated.

### 7.3 Manual sync button

Include a prominent **"Sync Google Sheets now"** button on the dashboard
and integration settings page. - Clicking it invokes a protected backend
route, not the Google API directly from the browser. - Show confirmation
only if needed; do not add unnecessary friction. - While running,
disable duplicate submissions and show a spinner plus "Syncing...". -
Display progress stages if available: checking configuration, reading
sheets, validating rows, fetching GitHub commits, calculating reports,
saving snapshot. - On success, show a toast/notice with completion time
and counts. - On failure, show a concise explanation and link to sync
details. - Refresh dashboard data only after the backend confirms a
successful publication. - Protect against repeated clicks and concurrent
scheduled/manual runs. - Require an authenticated/authorized admin if
authentication exists; otherwise document the MVP's access-control
assumption and protect all sync endpoints with a server-side secret or
equivalent appropriate mechanism.

### 7.4 Failure handling

-   Keep last known good analytics available.
-   Display `Last successful sync` separately from
    `Last attempted sync`.
-   If a sync fails, show the warning on the dashboard but continue
    serving the last good report.
-   Retry transient network errors with bounded exponential backoff.
-   Do not retry validation errors endlessly.
-   Do not log credentials, access tokens, or full secret values.
-   Capture enough context to debug failures, including
    spreadsheet/tab/repository identifiers (not secrets).
-   Add timeouts and API pagination handling.
-   Use idempotent processing so retrying the same sync cannot duplicate
    records.

------------------------------------------------------------------------

## 8. No-database artifact storage

Implement a storage abstraction with methods similar to: -
`readLatestAnalytics()` - `writeAnalyticsSnapshot(snapshot, date)` -
`publishLatestAnalytics(snapshot)` - `appendSyncHistory(run)` -
`readSyncHistory(filters)` - `acquireSyncLock()` - `releaseSyncLock()` -
`readIntegrationConfig()` where config is non-secret and storage-backed

Choose one concrete durable provider based on the target deployment
environment and document setup. Do not leave this as a vague stub. -
Preferred: private object storage with atomic/versioned writes and
suitable access permissions. - Alternative: private Google Drive folder
dedicated to application artifacts, with carefully handled concurrent
writes. - Local development may use a local directory, but warn that it
is not durable on ephemeral hosting. - Never store secrets in analytics
JSON, history logs, snapshots, or client-visible data.

### Latest report structure

Use a versioned JSON schema, for example: - `schemaVersion` -
`generatedAtUtc` - `displayTimezone` - `sourceStatus` -
`lastSuccessfulSyncAtUtc` - `filtersAvailable` - `summary` -
`projects[]` - `developers[]` - `categories[]` - `workLogs[]` or a
paginated/detail artifact if volume requires it -
`developerProjectCategoryMatrix` - `githubRepositories[]` -
`githubCommits[]` - `warnings[]`

Validate snapshots with Zod before publishing. Include a schema version
for future migrations.

### Daily snapshots

Support daily snapshots as a configuration option. If enabled, save the
source-normalized work log set and aggregate report for each successful
day. This allows comparisons across dates without a database. If
disabled, retain only the latest successful report plus sync history.
Document that this mode cannot reproduce previous report states if
source rows are later changed or deleted.

------------------------------------------------------------------------

## 9. Analytics and calculation requirements

All hours must be derived from Google Sheets logs, not from GitHub.

### Core calculations

-   Project hours = sum of valid log durations for the project.
-   Developer hours = sum of valid log durations for that developer.
-   Category hours = sum of valid log durations for that category.
-   Developer × project = sum grouped by developer and project.
-   Project × category = sum grouped by project and category.
-   Developer × category across all projects = sum grouped by developer
    and category.
-   Project × developer × category = sum grouped by project, developer,
    and category.
-   Project contribution percentage = developer's project hours /
    project's total hours × 100, with safe handling for zero totals.
-   Category percentage = category hours / selected total hours × 100.
-   Entry count = count of valid, deduplicated work-log entries, not
    count of raw sheet rows.
-   Commit counts must be displayed separately from hours.

### Filters

All relevant dashboards/reports must support: - Date range - Project -
Developer - Category - Repository for GitHub views

Ensure filtering uses the original work date for logs and the commit
timestamp for GitHub activity. Clearly show the timezone and selected
date range.

### Table drill-down

Where practical, clicking an aggregate value opens the filtered work-log
list that produced that number. Each row should display source sheet/tab
and source row context where available, without exposing sensitive
source information to unauthorized users.

### Export

Provide: - CSV export for filtered work logs and analytics tables - XLSX
export if a suitable maintained library is available - Print-friendly
PDF/report view if practical - Export metadata: generation time, date
range, active filters, and last successful sync time - Exports must use
the currently selected filters and should not invent or alter data.

------------------------------------------------------------------------

## 10. GitHub integration

### 10.1 Mapping

Allow multiple GitHub repositories to be mapped to one project and, if
necessary, one repository to multiple project contexts only when
explicitly configured. Do not infer mappings from repository names
alone.

Configuration for each mapping: - Project canonical ID/name - GitHub
owner - Repository name - Optional default branch - Optional GitHub
account-to-developer mapping - Initial history import range or maximum
commit count

### 10.2 Authentication and permissions

Use a GitHub App or a fine-grained token with the minimum read
permissions needed for the configured repositories. Keep credentials
server-side only. Document private-repository access requirements. Never
expose tokens to client JavaScript.

### 10.3 Initial import and updates

-   On first connection, fetch paginated commit history within a
    configurable limit/date range.
-   On subsequent syncs, fetch updates since the last successful
    repository sync, with an overlap window to handle boundary timing.
-   Deduplicate commits by full SHA plus repository identity.
-   Handle API pagination, rate limits, 404/403 responses, renamed
    repositories, and deleted/unavailable repositories.
-   Preserve the previous successful commit dataset if the repository
    fetch fails.
-   Where webhooks are later added, verify signatures and make event
    processing idempotent. Webhooks are optional for this nightly-sync
    MVP.

### 10.4 Commit fields

-   Repository owner/name and URL
-   Full SHA and short SHA
-   Commit message
-   Author name/email/date where returned and permitted
-   GitHub author login where GitHub maps the author
-   Committer name/email/date where returned
-   Commit URL
-   Parent SHAs if useful
-   Branch/ref only if the source endpoint/event actually supplies it;
    do not pretend the commit API always identifies a branch.
-   Fetched timestamp

Do not assume the GitHub account, author identity, committer identity,
and developer identity are always the same. Provide explicit mapping and
show unknown/unmapped authors distinctly.

------------------------------------------------------------------------

## 11. Suggested routes and modules

Use Next.js Route Handlers or equivalent routes appropriate to the
repository.

Suggested endpoints: - `GET /api/health` --- safe health/configuration
status without secrets - `GET /api/analytics` --- latest snapshot plus
filter parameters - `GET /api/projects` --- project summaries -
`GET /api/projects/[projectId]` --- project detail from snapshot -
`GET /api/developers` --- developer summaries - `GET /api/categories`
--- category summaries - `GET /api/github/commits` --- filtered commit
data - `GET /api/sync/history` --- sync history - `POST /api/sync` ---
authorized manual sync - `POST /api/cron/sync` --- scheduled sync,
protected with a cron secret - `GET /api/integrations/status` ---
configured/connected status without secrets -
`POST /api/integrations/google/test` --- test Google read access -
`POST /api/integrations/github/test` --- test GitHub read access

Suggested server modules: - `src/lib/google-sheets/client.ts` -
`src/lib/google-sheets/read-sources.ts` -
`src/lib/normalization/work-logs.ts` -
`src/lib/normalization/duration.ts` - `src/lib/github/client.ts` -
`src/lib/github/commits.ts` - `src/lib/analytics/aggregate.ts` -
`src/lib/sync/orchestrator.ts` - `src/lib/sync/lock.ts` -
`src/lib/storage/interface.ts` - `src/lib/storage/provider.ts` -
`src/lib/storage/local-dev.ts` - `src/lib/validation/schemas.ts` -
`src/lib/config/env.ts`

These are suggestions; adapt them to the actual repository structure
rather than creating duplicate or conflicting architectures.

------------------------------------------------------------------------

## 12. Security, privacy, and operational requirements

-   All Google and GitHub API calls requiring credentials must run
    server-side.
-   Use environment variables or the deployment secret manager.
-   Add a `.env.example` with names and placeholder values only.
-   Ensure `.env`, service-account JSON, token files, generated
    snapshots containing sensitive data, and logs with personal data are
    excluded from Git as appropriate.
-   Validate cron secret and manual sync authorization server-side.
-   Do not rely on hiding a UI button as authorization.
-   Add request size limits, timeouts, and sensible rate limits to
    manual sync.
-   Avoid logging full work descriptions or personal email addresses
    unless necessary for diagnosis.
-   Redact secrets from errors.
-   Keep source spreadsheets read-only from the app.
-   Never write back to source sheets, alter formatting, add tabs,
    delete rows, or reorder records.
-   Do not run migrations or create a database.
-   Do not deploy, change DNS, or alter production infrastructure
    without explicit authorization.
-   Add a clear distinction between demo/empty states and actual data.
    Do not ship fabricated analytics presented as real.
-   Protect internal sync endpoints and do not leak raw source data to
    unauthenticated users.

------------------------------------------------------------------------

## 13. Environment variables and configuration

Create `.env.example` with documented placeholders. Exact variables
depend on the chosen providers, but should cover equivalents of:

``` dotenv
# App
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=Asia/Kolkata

# Google Sheets (server-side only)
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_SOURCE_CONFIG=

# GitHub (server-side only)
GITHUB_AUTH_MODE=github_app_or_token
GITHUB_TOKEN=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_INSTALLATION_ID=

# Durable artifact storage (choose and document one provider)
ARTIFACT_STORAGE_PROVIDER=
ARTIFACT_STORAGE_BUCKET=
ARTIFACT_STORAGE_ENDPOINT=
ARTIFACT_STORAGE_ACCESS_KEY=
ARTIFACT_STORAGE_SECRET_KEY=
GOOGLE_DRIVE_ARTIFACT_FOLDER_ID=

# Scheduled sync protection
CRON_SECRET=

# Optional feature configuration
ENABLE_DAILY_SNAPSHOTS=false
GITHUB_INITIAL_IMPORT_DAYS=90
GITHUB_MAX_COMMITS_PER_REPOSITORY=500
```

Do not require irrelevant variables for the chosen storage/auth
provider. Validate configuration at startup or on the relevant
connection test, and give actionable errors for missing variables. Never
log private key contents or tokens.

Provide a separate, non-secret configuration file or settings UI for: -
Spreadsheet IDs and tab names - Header/column mappings - Developer
mapping - Project mapping - GitHub repository mapping - Category
normalization aliases if needed

Do not place secrets in that configuration file.

------------------------------------------------------------------------

## 14. Testing requirements

Add automated tests for: 1. Decimal hour conversion, `H:MM`, invalid
duration, negative duration, and rounding. 2. Header mapping with
reordered columns. 3. Multiple developer tabs and multiple spreadsheet
files. 4. Duplicate reads and stable log ID behavior. 5. Edited rows and
late-entered logs. 6. Sorting/inserting rows without corrupting identity
mapping. 7. Missing/unknown project, category, or developer. 8. All
analytics aggregation formulas and zero-hour edge cases. 9. Date
boundaries around midnight in `Asia/Kolkata`. 10. GitHub pagination,
duplicate commits, unmapped authors, and API failures. 11. Sync lock
prevents concurrent manual and scheduled runs. 12. Failed sync does not
replace the last successful report. 13. Artifact writes are verified
before publishing latest snapshot. 14. Manual sync success/failure UI
behavior. 15. Cron route rejects requests without a valid secret. 16.
Credentials never appear in client bundles or API responses. 17. No
database dependency or database connection is introduced.

Add at least one end-to-end flow using mocked Google/GitHub APIs and a
temporary local storage adapter. Test real external connections only
when credentials are explicitly provided.

------------------------------------------------------------------------

## 15. Definition of done

The project is not complete until all of the following are true:

-   [ ] The existing repository was inspected before edits.
-   [ ] The app runs locally using documented commands.
-   [ ] The UI uses shadcn/ui.
-   [ ] Only the two specified colors are used throughout the UI.
-   [ ] Inter is the only font family.
-   [ ] Dashboard, project, developer, category, GitHub activity, sync
    history, and settings pages exist.
-   [ ] Google Sheets source mapping is configurable.
-   [ ] Work logs can be read from multiple developer tabs or multiple
    files.
-   [ ] No code writes to developer source sheets.
-   [ ] Nightly sync is configured/documented for 11:59 PM
    `Asia/Kolkata`.
-   [ ] A manual "Sync Google Sheets now" button works end-to-end.
-   [ ] Sync runs have visible status and durable history.
-   [ ] Last successful analytics remain available after sync failure.
-   [ ] All requested aggregate analytics work and support filters.
-   [ ] GitHub repository mapping and commit history work.
-   [ ] GitHub commits are not converted into work hours.
-   [ ] CSV export works; other export formats are implemented or
    explicitly documented as deferred.
-   [ ] `.env.example`, setup instructions, deployment instructions, and
    troubleshooting guide are present.
-   [ ] Automated tests, lint, and TypeScript checks pass.
-   [ ] No database has been introduced.
-   [ ] No credentials are committed.
-   [ ] No production services or existing production projects were
    modified without authorization.

------------------------------------------------------------------------

## 16. Antigravity execution instructions

Follow these steps in order:

### Phase 1 --- Inspect and plan

1.  Inspect the current workspace, package manager, framework, folder
    structure, existing UI conventions, tests, and deployment
    assumptions.
2.  Determine whether this is a new or existing project. Do not
    overwrite an existing app blindly.
3.  Produce a short implementation plan and identify unknowns,
    especially Google Sheet layout, authentication, deployment platform,
    and artifact storage.
4.  If the workspace contains an existing production project, treat it
    as read-only until explicitly authorized. Work in a separate
    copy/worktree or new project directory.

### Phase 2 --- Build the foundation

1.  Set up or adapt Next.js, TypeScript, Tailwind, shadcn/ui, Inter, and
    the two-color theme.
2.  Implement page layouts, navigation, responsive components, loading
    states, empty states, and errors.
3.  Add typed schemas, normalized domain types, analytics aggregation,
    and mock fixtures strictly for development/testing.
4.  Clearly label all mock fixtures and never display them as live
    production data.

### Phase 3 --- Integrations and storage

1.  Implement Google Sheets read access and configurable mapping.
2.  Implement GitHub repository mapping and commit fetching.
3.  Implement durable artifact storage without a database.
4.  Implement the shared sync orchestrator, locking, idempotency,
    validation, and safe publication of the latest report.
5.  Implement manual sync and protected nightly sync routes.

### Phase 4 --- Analytics and exports

1.  Connect pages to the actual latest report API.
2.  Implement all required aggregates, filters, drill-downs, and commit
    views.
3.  Implement CSV export and any additional export formats selected.
4.  Implement sync history and integration health views.

### Phase 5 --- Verify

1.  Run unit tests, integration tests, lint, and TypeScript checks.
2.  Fix errors rather than merely documenting them.
3.  Verify the application builds and starts locally.
4.  Verify no database packages, schema, migrations, or connections were
    added.
5.  Verify all UI colors and font choices follow the design rules.
6.  Verify secrets are server-only and `.env.example` contains
    placeholders only.
7.  Verify failed sync leaves the prior successful snapshot intact.
8.  Verify manual sync and scheduled sync use the same orchestration
    code.

### Phase 6 --- Handover

Create/update: - `README.md` --- project overview and local setup -
`docs/GOOGLE_SHEETS_SETUP.md` --- Google API, permissions, sheet
mapping - `docs/GITHUB_SETUP.md` --- GitHub auth, repository mapping,
API permissions - `docs/SYNC_ARCHITECTURE.md` --- nightly/manual sync,
storage, retries, locks, failures - `docs/DEPLOYMENT.md` --- deployment
and cron setup for the chosen platform - `docs/OPERATIONS.md` ---
monitoring, sync history, troubleshooting, recovery - `.env.example` -
This project specification as `PROJECT_SPEC.md`

At the end, report: - What was implemented - Important files
created/changed - Exact local run/test commands - Required environment
variables and configuration steps - How to connect the actual
spreadsheets and GitHub repositories - How to test manual sync - How to
verify the nightly schedule - Any remaining blockers or assumptions

Do not claim an integration works until it has been tested with valid
credentials. If credentials are not available, implement the integration
and mock-based tests, then document exactly what the user must configure
to activate it.
