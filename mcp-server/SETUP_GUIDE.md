# Carpe Analytics MCP Tracker & Git Commit Auto-Logger Setup Guide

This guide provides end-to-end instructions for installing, configuring, updating, and troubleshooting the **Carpe Analytics MCP Tracker** and **Global Git Commit Auto-Logger** on **macOS**, **Windows**, and **Linux**.

---

## Table of Contents
1. [How It Works (MCP Tools + Auto-Commit Logging)](#1-how-it-works)
2. [Fresh Installation (For New Developers)](#2-fresh-installation-for-new-developers)
   - [macOS (Apple Silicon & Intel)](#21-macos-setup)
   - [Windows (PowerShell)](#22-windows-setup)
   - [Linux (Ubuntu / Debian / Snap)](#23-linux-setup)
3. [Upgrade Guide (For Existing Developers / Already Cloned)](#3-upgrade-guide-for-existing-developers)
4. [Manual Editor Configuration (Alternative to Auto-Setup)](#4-manual-editor-configuration)
5. [Testing & Verification](#5-testing--verification)
   - [Test 1: Verify AI Assistant MCP Tools](#test-1-verify-ai-assistant-mcp-tools)
   - [Test 2: Verify Automatic Git Commit Logging](#test-2-verify-automatic-git-commit-logging)
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
│   for Univ Diam fixing bug"      │                  │                  │
│                │                 │                  ▼                  │
│                ▼                 │        [Global Post-Commit Hook]    │
│         [MCP Server Tools]       │        • Calculates elapsed time    │
│         • log_work               │        • Resolves project & client  │
│         • get_my_logs            │        • Maps commit category       │
│         • list_projects          │                  │                  │
└────────────────┬─────────────────┴──────────────────┬──────────────────┘
                 │                                    │
                 ▼                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             CARPE ANALYTICS CLOUD PLATFORM             │
       │     (https://analytics-two-ashen.vercel.app/api)       │
       │                                                        │
       │ • Deduplicated Client & Project Breakdown              │
       │ • Developer Dashboard & Live Work Logs                 │
       │ • Synchronized with Neon Database & GitHub Sync        │
       └────────────────────────────────────────────────────────┘
```

1. **Conversational AI Logging (MCP Tools)**:
   Your AI assistant (Cursor, Claude Desktop, Antigravity CLI, Windsurf, Zed) gains native tools (`log_work`, `get_my_logs`, `list_projects`, `list_categories`). You can log time conversationally at any point during pair programming.

2. **Automatic Git Commit Logging (Zero-Effort Background Logging)**:
   Whenever you run `git commit` in any repository linked to a project in the analytics system (e.g. `custom-portal`, `cad-portal`, `admin-portal`):
   - The global Git hook triggers automatically in the background.
   - It captures the commit hash, author, branch, and commit message.
   - It intelligently calculates time worked since your previous commit.
   - It categorizes the task based on standard commit conventions (`feat:` → *Frontend/Backend*, `fix:` → *Bug Fix*, `docs:` → *Documentation*, etc.).
   - It transmits the log directly to the Analytics API and outputs a confirmation badge right inside your terminal:
     ```bash
     ✔ [Analytics] Logged 0.75h to Custom Portal (Univ Diam) | Today's Total: 3.5h
     ```

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
2. Generates the global Git hook in `~/.git-tracker-hooks/post-commit`.
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
2. Installs the global post-commit hook in `%USERPROFILE%\.git-tracker-hooks\post-commit`.
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

If you use Antigravity Snap, the setup script automatically writes the configuration to both your standard system home and your Snap common sandbox (`~/snap/antigravity-cli/common/.gemini/config/mcp_config.json`).

---

## 3. Upgrade Guide (For Existing Developers)

If you have **already cloned** `tracker-mcp` in the past and want to update to the latest version with automatic commit logging and updated project/client sync:

### Step 1: Pull Latest Changes & Rebuild
Open terminal/PowerShell and navigate to your existing directory:

**macOS / Linux:**
```bash
cd ~/mcp-servers/tracker-mcp
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

### Step 2: Re-run Setup or Enable the Git Hook
You can either refresh your entire setup:
```bash
node build/index.js setup --name "Your Full Name"
```

Or, if you only want to install/update the **Global Git Auto-Commit Hook**:
```bash
node build/index.js install-hook --global
```

### Step 3: Verify the Git Hook Registration
Run:
```bash
git config --global core.hooksPath
```
- **macOS / Linux**: It should output `/Users/yourname/.git-tracker-hooks` (or `~/.git-tracker-hooks`).
- **Windows**: It should output `C:/Users/yourname/.git-tracker-hooks`.

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

### Test 1: Verify AI Assistant MCP Tools
1. Restart your AI editor (Cursor, Claude, or Antigravity).
2. Open any conversation and ask:
   > "What projects are available in the analytics tracker?"
3. The AI will invoke `list_projects` and list all synchronized projects and clients (e.g. *Custom Portal [CP-UD]* under *Univ Diam*, *CAD Portal* under *Carpe Diem*, etc.).
4. Test manual logging:
   > "Log 1h on Custom Portal for Univ Diam doing testing."
5. The AI will invoke `log_work` and return the logged entry and updated daily total.

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
   *(Without the `--global` flag, it installs directly into `.git/hooks/post-commit`)*.

2. **Option B (Husky integration)**:
   If the repo uses Husky, add this single line at the end of `.husky/post-commit` (or `.husky/pre-push`):
   ```bash
   node /path/to/tracker-mcp/build/index.js git-hook post-commit
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
- The hook checks the timestamp of your current commit and compares it to your previous commit in that repository.
- If commits are within standard working intervals (e.g. 45 minutes apart), it logs the exact elapsed time (rounded to 15-minute increments).
- If this is your first commit of the day or there is a large multi-day gap, it assigns a sensible default work block (e.g., 0.5h to 1.0h) to prevent logging overnight inactive hours.
</details>

<details>
<summary><h3>Q6: Will a failed Git hook block my commit?</h3></summary>

**No.** The Git hook is designed to be completely non-blocking. If your network is offline, the API is unreachable, or a project is not recognized, Git will display a gentle terminal warning, but your `git commit` or `git push` will **never be halted or failed**.
</details>
