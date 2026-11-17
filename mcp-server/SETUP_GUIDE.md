# Carpe Analytics MCP Tracker & Git Commit Auto-Logger Setup Guide

This guide provides end-to-end instructions for installing, configuring, updating, and troubleshooting the **Carpe Analytics MCP Tracker** and **Global Git Commit Auto-Logger** on **macOS**, **Windows**, and **Linux**.

---

## Table of Contents
1. [How It Works (MCP Tools + Auto-Commit Logging)](#1-how-it-works)
   - [Real-Time Active Sessions & The "First Task" Solution](#real-time-active-sessions--the-first-task-solution)
   - [Time Calculation & Intelligent Windowing](#time-calculation--intelligent-windowing)
   - [Cross-Midnight Shift Pro-Rating (24/7 Developer Support)](#cross-midnight-shift-pro-rating-247-developer-support)
   - [Manual Time Overrides & Anti-Manipulation Protection](#manual-time-overrides--anti-manipulation-protection)
2. [Fresh Installation (For New Developers)](#2-fresh-installation-for-new-developers)
   - [macOS (Apple Silicon & Intel)](#21-macos-setup)
   - [Windows (PowerShell)](#22-windows-setup)
   - [Linux (Ubuntu / Debian / Snap)](#23-linux-setup)
3. [Upgrade Guide (For Existing Developers / Already Cloned)](#3-upgrade-guide-for-existing-developers)
4. [Manual Editor Configuration (Alternative to Auto-Setup)](#4-manual-editor-configuration)
5. [Testing & Verification](#5-testing--verification)
   - [Test 1: Verify AI Assistant MCP Tools & Active Session](#test-1-verify-ai-assistant-mcp-tools--active-session)
   - [Test 2: Verify Automatic Git Commit Logging](#test-2-verify-automatic-git-commit-logging)
   - [Test 3: Verify Branch Checkout Session Anchor](#test-3-verify-branch-checkout-session-anchor)
6. [Troubleshooting & Common Questions](#6-troubleshooting--common-questions)

---

## 1. How It Works

The tracker integrates your developer workflow into the **Project Analytics Platform** through two complementary channels:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER ENVIRONMENT                           │
├──────────────────────────────────┬─────────────────────────────────────┤
│      1. AI ASSISTANT (MCP)       │       2. GIT COMMITS & PUSHES       │
│  (Cursor / Claude / Antigravity) │          (Any Terminal / IDE)       │
│                                  │                                     │
│  "Log 1.5h on Custom Portal      │  git commit -m "feat(auth): login"  │
│   for Univ Diam fixing bug"      │  git checkout -b feat/new-module    │
│                │                 │                  │                  │
│                ▼                 │                  ▼                  │
│      [MCP Server Tools]          │        [Dual Global Git Hooks]      │
│      • log_work                  │        • post-commit (Auto-Logger)  │
│      • start_task                │        • post-checkout (Session)    │
│      • get_active_session        │        • Calculates elapsed time    │
│      • list_projects             │        • Resolves project & client  │
│      • get_my_logs               │        • Splits cross-midnight logs │
│      • Auto Heartbeat Touch      │                                     │
└────────────────┬─────────────────┴──────────────────┬──────────────────┘
                 │                                    │
                 ▼                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             CARPE ANALYTICS CLOUD PLATFORM             │
       │     (https://analytics-two-ashen.vercel.app/api)       │
       │                                                        │
       │ • Deduplicated Client & Project Breakdown              │
       │ • Real-time Session Anchors & Midnight Slicing         │
       │ • Anti-Manipulation Durations & Audit History          │
       │ • Segregation of Duties (SoD) Verification             │
       └────────────────────────────────────────────────────────┘
```

1. **Conversational AI Logging (MCP Tools)**:
   Your AI assistant (Cursor, Claude Desktop, Antigravity CLI, Windsurf, Zed) gains native tools:
   - `start_task`: Explicitly mark the start of a coding task on a project with description.
   - `get_active_session`: Query current active session duration and start time.
   - `log_work`: Manually log a specific time entry conversationally.
   - `get_my_logs`: Retrieve today's logged hours and task summaries.
   - `list_projects` & `list_categories`: Browse configured projects and category IDs.
   - **Silent Heartbeats**: MCP automatically pings the server with a lightweight heartbeat whenever your AI assistant initializes or runs a tool, maintaining continuous session awareness.

2. **Dual Global Git Hooks (Zero-Effort Background Tracking)**:
   - **`post-checkout` Hook**: Triggers whenever you switch branches (`git checkout` / `git switch`). Silently registers a session start anchor for that repository and branch.
   - **`post-commit` Hook**: Triggers on every `git commit`. It captures commit metadata, calculates duration anchored to your active session start, resolves client and project, splits cross-midnight hours if applicable, and logs the work entry.
   - Terminal confirmation badge output:
     ```bash
     ✔ [Analytics] Logged 1.25h to Custom Portal (Univ Diam) | Today's Total: 3.5h
     ```

### Real-Time Active Sessions & The "First Task" Solution

In traditional commit trackers, the very first commit of the day presents a problem: because there is no prior commit to measure against, trackers are forced to guess an arbitrary flat number (like 45 minutes).

The Carpe Analytics Tracker solves this definitively:
- When you open your AI editor, chat with the assistant, or switch branches (`git checkout -b feature`), a server-side **active session timestamp** is anchored.
- When you create your first commit 2 hours later, the system measures against this anchored start time and records the genuine **2.0 hours** worked.
- If no session was anchored and no prior commit exists, it safely defaults to 45 minutes (0.75h).

### Time Calculation & Intelligent Windowing

- **Continuous Sessions**: Between sequential commits on the same day, elapsed time is measured and rounded to 5-minute increments.
- **Micro-Commits**: Commits created within 10 minutes of a previous commit are floored to **10 minutes (0.17h)** so quick typo fixes or formatting changes receive appropriate minimum credit.
- **Idle Gap Capping**: If you step away for lunch or leave a chat window open for hours without activity, gaps exceeding **90 minutes** are capped to prevent idle runaway accumulation.

### Cross-Midnight Shift Pro-Rating (24/7 Developer Support)

For developers working night shifts or across midnight (e.g. 10:00 PM to 4:00 AM):
- The server computes the developer's local midnight timestamp using their local timezone (default `Asia/Kolkata` / configurable).
- Instead of dumping all 6 hours into a single day, the commit automatically generates **two distinct pro-rated entries**:
  - **Day 1**: 10:00 PM – 12:00 AM (2.0 hours logged on Day 1).
  - **Day 2**: 12:00 AM – 4:00 AM (4.0 hours logged on Day 2).
- Both logs link to the same commit hash with full audit trail in the analytics dashboard.

### Manual Time Overrides & Anti-Manipulation Protection

If you worked offline or spent hours researching before committing, you can specify custom duration tags in your commit message:

```bash
# Explicit hours
git commit -m "feat(auth): complete OAuth migration [time: 3h]"
git commit -m "fix(cad): resolve heavy mesh render leak [2.5h]"

# Minute formats
git commit -m "docs: write architecture overview [90m]"
```

**Supported tag patterns:**
`[time: 3h]`, `[3h]`, `[2.5 hrs]`, `[2h 30m]`, `[90m]`

**Anti-Manipulation Clamping:**
To prevent developers from arbitrarily tagging unrealistic durations (e.g. claiming `[time: 10h]` on a 15-minute commit):
- The server validates the claimed time against actual elapsed session time and recent commit history (+15 minutes grace).
- If the claimed tag exceeds verifiable elapsed time, the system clamps the logged duration to the legitimate elapsed maximum, logging an audit notice on the dashboard while honoring honest work.

---

## 2. Fresh Installation (For New Developers)

Follow the section for your operating system:

### 2.1. macOS Setup

#### Step 1: Ensure Prerequisites
Verify that **Node.js** (v18+) and **Git** are installed:
```bash
node -v
git --version
```
*(If Node.js is missing, install via Homebrew: `brew install node git`)*.

#### Step 2: Clone and Build the Tracker
Choose a standard visible directory in your user profile:
```bash
mkdir -p ~/mcp-servers
cd ~/mcp-servers
git clone https://github.com/Carpe25/tracker-mcp.git
cd tracker-mcp
npm install
npm run build
```

#### Step 3: Run the Auto-Setup Command
Run the setup command, replacing `"Your Full Name"` with your developer name:
```bash
node build/index.js setup --name "Your Full Name"
```
*(Optional: If your team uses a custom deployment URL, pass `--url https://your-domain.com/api`)*.

**What this command does automatically:**
1. Detects and configures all installed AI editors (**Cursor**, **Claude Desktop**, **Antigravity CLI**, **Windsurf**, **Zed**, and **VS Code Cline**).
2. Generates the dual global Git hooks in `~/.git-tracker-hooks/`:
   - `post-commit`: Automatically logs duration and commit details to analytics.
   - `post-checkout`: Automatically anchors session start whenever you checkout/switch branches.
3. Configures `git config --global core.hooksPath ~/.git-tracker-hooks`.

#### Step 4: Restart Your Editors
Quit and restart your AI editor (Cursor, Claude Desktop, etc.) so it loads the newly added MCP tools.

---

### 2.2. Windows Setup

#### Step 1: Ensure Prerequisites
1. Install **Node.js LTS (v18+)** from [nodejs.org](https://nodejs.org/). Make sure the option **"Add to PATH"** is checked.
2. Install **Git for Windows** from [git-scm.com](https://git-scm.com/).
3. Open **PowerShell** and verify:
   ```powershell
   node -v
   npm -v
   git --version
   ```

#### Step 2: Clone and Build the Tracker
In **PowerShell**, run:
```powershell
# Create a dedicated directory in your user profile
New-Item -ItemType Directory -Force -Path "$HOME\mcp-servers"
cd "$HOME\mcp-servers"

# Clone repository
git clone https://github.com/Carpe25/tracker-mcp.git
cd tracker-mcp

# Install dependencies and compile
npm install
npm run build
```

> [!TIP]
> If PowerShell blocks `npm` with a script execution policy error, run:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

#### Step 3: Run the Auto-Setup Command
Run the setup command with your developer name:
```powershell
node build/index.js setup --name "Your Full Name"
```

**What this command does automatically on Windows:**
1. Writes valid, properly-escaped JSON configurations to Cursor (`%APPDATA%\Cursor` and `%USERPROFILE%\.cursor`), Claude Desktop (`%APPDATA%\Claude`), Windsurf, and Antigravity.
2. Installs the dual global Git hooks:
   - `%USERPROFILE%\.git-tracker-hooks\post-commit` (auto-logger)
   - `%USERPROFILE%\.git-tracker-hooks\post-checkout` (session anchor)
3. Sets `git config --global core.hooksPath "$HOME/.git-tracker-hooks"`.

#### Step 4: Restart Your Editors
Close and reopen Cursor / Claude Desktop to load the tools.

---

### 2.3. Linux Setup

#### Step 1: Ensure Prerequisites
```bash
node -v
git --version
```
*(If missing: `sudo apt update && sudo apt install nodejs npm git`)*.

#### Step 2: Clone and Build
> [!IMPORTANT]
> **Avoid hidden directories**: If you use Antigravity CLI via **Snap**, Snap's AppArmor sandbox strictly blocks access to dot-folders like `~/.mcp`. Always use a visible path like `~/mcp-servers/tracker-mcp`.

```bash
mkdir -p ~/mcp-servers
cd ~/mcp-servers
git clone https://github.com/Carpe25/tracker-mcp.git
cd tracker-mcp
npm install
npm run build
```

#### Step 3: Run Auto-Setup
```bash
node build/index.js setup --name "Your Full Name"
```

If you use Antigravity Snap, the setup script automatically writes the configuration to both your standard system home and your Snap common sandbox (`~/snap/antigravity-cli/common/.gemini/config/mcp_config.json`). It also generates both `post-commit` and `post-checkout` hooks in `~/.git-tracker-hooks/`.

---

## 3. Upgrade Guide (For Existing Developers)

If you have **already cloned** `tracker-mcp` in the past and want to update to the latest version with automatic commit logging and updated project/client sync:

### Step 1: Pull Latest Changes & Rebuild
Open terminal/PowerShell and navigate to your existing directory:

**macOS / Linux:**
```bash
cd ~/mcp-servers/tracker-mcp  # or your local clone of Analytics system
git pull origin main
npm install
npm run build
```

**Windows (PowerShell):**
```powershell
cd "$HOME\mcp-servers\tracker-mcp"
git pull origin main
npm install
npm run build
```

### Step 2: Update the Global Git Hooks
Run the hook installer to update your global `post-commit` (auto-logger with midnight split) and install `post-checkout` (session auto-start on branch switch):
```bash
node build/index.js install-hook --global
```

### Step 3: Restart Your Editor / AI Agent
Restart your editor (Cursor, VS Code, Claude Desktop, Antigravity) so that it terminates the previous background Node MCP process and launches the new build with `start_task` and `get_active_session`.

### Step 4: Verify the Installation
Run:
```bash
git config --global core.hooksPath
```
- **macOS / Linux**: It should output `/Users/yourname/.git-tracker-hooks` (or `~/.git-tracker-hooks`).
- **Windows**: It should output `C:/Users/yourname/.git-tracker-hooks`.

And in your AI editor chat, verify by asking:
> *"What is my active session status?"* (should invoke `get_active_session`).

---

## 4. Manual Editor Configuration

If you prefer configuring your editor JSON files by hand rather than using the auto-setup script, use the appropriate snippet below:

### Cursor Configuration
- **macOS / Linux Path**: `~/.cursor/mcp.json` (or `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json`)
- **Windows Path**: `%USERPROFILE%\.cursor\mcp.json`

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/mcp-servers/tracker-mcp/build/index.js"
      ],
      "env": {
        "TRACKER_API_URL": "https://analytics-two-ashen.vercel.app/api",
        "DEVELOPER_NAME": "Your Full Name"
      }
    }
  }
}
```
*(On Windows, use forward slashes in path: `"C:/Users/YOUR_USERNAME/mcp-servers/tracker-mcp/build/index.js"`)*.

### Claude Desktop Configuration
- **macOS Path**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows Path**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "/usr/local/bin/node",
      "args": [
        "/Users/YOUR_USERNAME/mcp-servers/tracker-mcp/build/index.js"
      ],
      "env": {
        "TRACKER_API_URL": "https://analytics-two-ashen.vercel.app/api",
        "DEVELOPER_NAME": "Your Full Name"
      }
    }
  }
}
```
*(On Apple Silicon Macs, run `which node` and use `/opt/homebrew/bin/node`)*.

### Antigravity / Gemini CLI Configuration
- **Standard Linux / macOS**: `~/.gemini/config/mcp_config.json`
- **Snap Linux**: `~/snap/antigravity-cli/common/.gemini/config/mcp_config.json`
- **Windows**: `%USERPROFILE%\.gemini\config\mcp_config.json`

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": [
        "/home/username/mcp-servers/tracker-mcp/build/index.js"
      ],
      "env": {
        "TRACKER_API_URL": "https://analytics-two-ashen.vercel.app/api",
        "DEVELOPER_NAME": "Your Full Name"
      }
    }
  }
}
```

---

## 5. Testing & Verification

### Test 1: Verify AI Assistant MCP Tools & Active Session
1. Restart your AI editor (Cursor, Claude, or Antigravity).
2. Open any conversation and ask:
   > *"What projects are available in the analytics tracker?"*
   The AI invokes `list_projects` and lists all synchronized projects and clients.
3. Check your active session status:
   > *"What is my active session status?"*
   The AI invokes `get_active_session` and reports the elapsed time and start timestamp.
4. Test manual logging:
   > *"Log 1h on Custom Portal for Univ Diam doing testing."*
   The AI invokes `log_work` and returns the logged entry and updated daily total.

### Test 2: Verify Automatic Git Commit Logging
1. Open any repository connected to a project on the Analytics platform.
2. Make a small code change or test edit.
3. Commit the change via terminal or Git GUI:
   ```bash
   git commit -m "feat(ui): test auto commit time tracking"
   ```
4. Look at your terminal output immediately following the commit. You will see:
   ```bash
   ✔ [Analytics] Logged 0.5h to Custom Portal (Univ Diam) | Today's Total: 3.5h
   ```
5. Check your live dashboard at `https://analytics-two-ashen.vercel.app/projects` — the work log and commit will appear in your project metrics!

### Test 3: Verify Branch Checkout Session Anchor
1. In your repository terminal, switch or create a branch:
   ```bash
   git checkout -b feature/auth-redesign
   ```
2. The `post-checkout` hook runs silently in the background and registers the start anchor with the API.
3. When you make your first commit on that branch, elapsed time is calculated from this exact moment!

---

## 6. Troubleshooting & Common Questions

<details>
<summary><h3>Q1: My repository uses Husky, and the global commit hook doesn't run</h3></summary>

**Cause:**
If a specific repository has local hooks configured (or uses Husky with `git config core.hooksPath .husky`), Git's local repository config takes precedence over the global `core.hooksPath`.

**Solution:**
You can either:
1. **Option A (Install hook directly in this repo)**:
   Navigate to the repository and run:
   ```bash
   node /path/to/tracker-mcp/build/index.js install-hook
   ```
   *(Without the `--global` flag, it installs directly into `.git/hooks/post-commit` and `.git/hooks/post-checkout`)*.

2. **Option B (Husky integration)**:
   If the repo uses Husky, add this single line at the end of `.husky/post-commit`:
   ```bash
   node /path/to/tracker-mcp/build/index.js git-hook post-commit
   ```
   And in `.husky/post-checkout`:
   ```bash
   node /path/to/tracker-mcp/build/index.js git-hook post-checkout
   ```
</details>

<details>
<summary><h3>Q2: <code>node: command not found</code> in Claude Desktop or Cursor</h3></summary>

**Cause:**
On macOS and Windows, GUI apps launched from desktop shortcuts or Spotlight do not inherit shell paths set in `.zshrc` or `.bashrc` (especially when using version managers like `nvm` or `fnm`).

**Solution:**
Replace `"command": "node"` with the full absolute path to your Node.js binary:
- **macOS (Homebrew Apple Silicon)**: `/opt/homebrew/bin/node`
- **macOS (Homebrew Intel)**: `/usr/local/bin/node`
- **Windows**: `C:\\Program Files\\nodejs\\node.exe` (run `where.exe node` in cmd to find your path).
</details>

<details>
<summary><h3>Q3: Windows JSON "Unexpected token \" error</h3></summary>

**Cause:**
Single backslashes `\` in Windows paths are escape characters in JSON.

**Solution:**
Always use **forward slashes** `/` in JSON config paths:
```json
"args": ["C:/Users/YourName/mcp-servers/tracker-mcp/build/index.js"]
```
*(Node.js and Windows natively support forward slashes in file paths)*.
</details>

<details>
<summary><h3>Q4: How does the commit auto-logger know which project and client to log to?</h3></summary>

**Resolution Priority:**
1. **GitHub Remote Match**: The hook extracts `owner/repo` from `git remote get-url origin` and matches it against the repository configured in the Analytics System (under **Projects** → **Connect Repo**).
2. **Project Code & Name Match**: If no remote is configured, it inspects the folder name or project code.
3. **Commit Convention Categorization**: Commit prefixes are automatically mapped:
   - `feat: ...` → *Frontend* / *Backend* / *New Feature*
   - `fix: ...` / `bug: ...` → *Bug Fix*
   - `docs: ...` → *Documentation*
   - `test: ...` → *Testing*
   - `refactor: ...` / `perf: ...` → *Improvement*
</details>

<details>
<summary><h3>Q5: How is time calculated between commits?</h3></summary>

**Smart Time Elapsed Calculation:**
- The hook checks your **active session start anchor** (recorded when your AI editor booted or when you ran `git checkout`).
- If this is your first commit after starting work, it logs the genuine elapsed time between that anchor and your commit.
- For consecutive commits on the same day, it logs the delta between commits rounded to 5 minutes.
- If you were idle for over 90 minutes, it caps the idle gap so inactive hours are never counted.
</details>

<details>
<summary><h3>Q6: Will a failed Git hook block my commit?</h3></summary>

**No.** The Git hook is designed to be completely non-blocking. If your network is offline, the API is unreachable, or a project is not recognized, Git will display a gentle terminal warning, but your `git commit` or `git push` will **never be halted or failed**.
</details>

<details>
<summary><h3>Q7: What happens if I work late at night past midnight?</h3></summary>

**Automatic Midnight Splitting:**
If you start coding at 10:00 PM and commit at 4:00 AM, the server automatically splits the duration across the midnight boundary into two distinct logs:
- **Yesterday's date**: 2.0h (10 PM to 12 AM)
- **Today's date**: 4.0h (12 AM to 4 AM)
Daily statistics and analytics charts remain 100% accurate without manual calculation.
</details>

<details>
<summary><h3>Q8: How does the system prevent inflated commit tags like <code>[time: 10h]</code>?</h3></summary>

**Anti-Manipulation Clamping:**
The server verifies custom time tags against your server-side session heartbeats and commit history (+ 15m grace period). Unverified claims that exceed the actual elapsed work window are clamped to the true elapsed time, protecting team metrics while preventing time padding.
</details>
