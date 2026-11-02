# Cross-Platform MCP Tracker Setup Guide (macOS & Windows)

This guide walks you through installing, configuring, and troubleshooting the **Carpe Analytics MCP Tracker** on **macOS** and **Windows** (with Linux reference included).

---

## Table of Contents
1. [Overview & Requirements](#1-overview--requirements)
2. [macOS Setup Guide](#2-macos-setup-guide)
3. [Windows Setup Guide](#3-windows-setup-guide)
4. [Linux & Snap Sandbox Reference](#4-linux--snap-sandbox-reference)
5. [Testing & Verification](#5-testing--verification)
6. [Troubleshooting & Common Issues](#6-troubleshooting--common-issues)
   - [Issue 1: `node: command not found` in GUI Apps (macOS/Windows)](#issue-1-node-command-not-found-in-gui-apps)
   - [Issue 2: Windows JSON Backslash Escaping](#issue-2-windows-json-backslash-escaping)
   - [Issue 3: PowerShell Execution Policy Restrictions on Windows](#issue-3-powershell-execution-policy-restrictions)
   - [Issue 4: AI Assistant Does Not Detect New Tools (Restarting)](#issue-4-ai-assistant-does-not-detect-new-tools)
   - [Issue 5: API Connection / Firewall / VPN Issues](#issue-5-api-connection-or-vpn-issues)
   - [Issue 6: Developer Name & Client Name Matching](#issue-6-developer-name--client-name-matching)

---

## 1. Overview & Requirements

The **Carpe Analytics MCP Tracker** exposes Model Context Protocol (MCP) tools (`log_work`, `get_daily_summary`, `get_available_projects`, etc.) to AI assistants (Cursor, Claude Desktop, Antigravity, Windsurf, Zed).

### Prerequisites:
- **Node.js**: Version 18.0 or newer (Run `node -v` to verify).
- **Git**: Installed and available in PATH.
- **AI Assistant**: Any of Cursor, Claude Desktop, Antigravity / Gemini CLI, Windsurf, or Zed.

---

## 2. macOS Setup Guide

### Step 1: Install Node.js & Git (if not already installed)
If you don't have Node.js, install it via Homebrew:
```bash
brew install node git
```
Check installation:
```bash
node -v
git --version
```

### Step 2: Clone & Build the Tracker
Choose a standard visible directory (avoid hidden folders starting with a dot):
```bash
mkdir -p ~/mcp-servers
cd ~/mcp-servers
git clone https://github.com/Carpe25/tracker-mcp.git
cd tracker-mcp
npm install
npm run build
```

### Step 3: Run the Auto-Setup Script
Run the automated configuration command, replacing `"Your Name"` with your developer name:
```bash
node build/index.js setup --name "Your Name"
```
*(Optionally pass `--url https://analytics-two-ashen.vercel.app/api` if using a custom endpoint).*

The setup script automatically:
1. **Configures all AI Editors**:
   - **Cursor**: `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json` and `~/.cursor/mcp.json`
   - **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Antigravity CLI**: `~/.gemini/config/mcp_config.json`
   - **Windsurf**: `~/.codeium/windsurf/mcp_config.json`
   - **Zed Editor**: `~/.config/zed/settings.json`
2. **Installs the Global Git Auto-Logger Hook**:
   - Creates `~/.git-tracker-hooks/post-commit`
   - Sets `git config --global core.hooksPath ~/.git-tracker-hooks`
   - **Zero additional setup needed**: Whenever you `git commit` or `git push` in any connected repository (e.g., `admin-portal`), your work and time from the last commit are logged automatically to that project and client (e.g., **Admin Portal** under **Carpe Diem**)!

### Step 4: Manual macOS Configuration (Alternative)
If you prefer configuring manually, add this block to your editor's config file (e.g., `~/.cursor/mcp.json` or `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "/usr/local/bin/node",
      "args": [
        "/Users/YOUR_MAC_USERNAME/mcp-servers/tracker-mcp/build/index.js"
      ],
      "env": {
        "TRACKER_API_URL": "https://analytics-two-ashen.vercel.app/api",
        "DEVELOPER_NAME": "Your Name"
      }
    }
  }
}
```
*(On Apple Silicon Macs, Homebrew node is at `/opt/homebrew/bin/node`; run `which node` to find your exact path).*

---

## 3. Windows Setup Guide

### Step 1: Install Node.js & Git for Windows
1. Download and run the **Node.js LTS installer (.msi)** from [nodejs.org](https://nodejs.org/). Ensure **"Add to PATH"** is selected.
2. Install **Git for Windows** from [git-scm.com](https://git-scm.com/).
3. Open **PowerShell** or **Command Prompt** as an administrator or your standard user and verify:
   ```powershell
   node -v
   npm -v
   git --version
   ```

### Step 2: Clone & Build the Tracker
Open **PowerShell** and run:
```powershell
# Create a dedicated directory in your user profile
New-Item -ItemType Directory -Force -Path "$HOME\mcp-servers"
cd "$HOME\mcp-servers"

# Clone the repository
git clone https://github.com/Carpe25/tracker-mcp.git
cd tracker-mcp

# Install dependencies and build
npm install
npm run build
```

### Step 3: Run the Auto-Setup Script
Run the automated configuration script:
```powershell
node build/index.js setup --name "Your Name"
```

On Windows, the script automatically:
1. **Configures all AI Editors**:
   - **Cursor**: `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json` and `%USERPROFILE%\.cursor\mcp.json`
   - **Claude Desktop**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Windsurf**: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
   - **Antigravity CLI**: `%USERPROFILE%\.gemini\config\mcp_config.json`
2. **Installs the Global Git Auto-Logger Hook**:
   - Creates `%USERPROFILE%\.git-tracker-hooks\post-commit`
   - Configures Git: `git config --global core.hooksPath "$HOME/.git-tracker-hooks"`
   - Automatically tracks every commit and push across your connected repositories!

### Step 4: Manual Windows Configuration (Alternative)
If you configure manually, create or edit `%USERPROFILE%\.cursor\mcp.json` or `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": [
        "C:/Users/YOUR_WINDOWS_USERNAME/mcp-servers/tracker-mcp/build/index.js"
      ],
      "env": {
        "TRACKER_API_URL": "https://analytics-two-ashen.vercel.app/api",
        "DEVELOPER_NAME": "Your Name"
      }
    }
  }
}
```
> **Note on Windows Paths:** In JSON files, either use **forward slashes** (`C:/Users/...`) or **escaped double backslashes** (`C:\\Users\\...`). Single backslashes will cause JSON parse failures!

---

## 4. Linux & Snap Sandbox Reference

If running on Ubuntu/Debian where Antigravity CLI is installed via **Snap**:
- **Do not clone into hidden folders like `~/.mcp`**: Snap's AppArmor sandbox blocks access to dot-directories in `/home/user/` with `Permission denied`. Always use a visible folder like `~/mcp-servers/tracker-mcp`.
- **Snap Home vs System Home**: Snap uses `/home/$USER/snap/antigravity-cli/common` as `$HOME`.
- Global config for Antigravity Snap must be located at:
  `/home/$USER/snap/antigravity-cli/common/.gemini/config/mcp_config.json`

---

## 5. Testing & Verification

### Test 1: Verify via Command Line (Stdio Test)
Run this command from any terminal to check that the MCP server starts and responds:

**macOS / Linux:**
```bash
node -e '
const { spawn } = require("child_process");
const p = spawn("node", ["build/index.js"], {
  env: { ...process.env, TRACKER_API_URL: "https://analytics-two-ashen.vercel.app/api", DEVELOPER_NAME: "Test" }
});
p.stdout.on("data", d => { console.log("Response:", d.toString()); p.kill(); });
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } } }) + "\n");
'
```

**Windows (PowerShell):**
```powershell
node build/index.js
```
*(If it outputs `[tracker-mcp] Server running on stdio transport.` and waits for input, press `Ctrl+C` to exit. It works!)*

### Test 2: In Your AI Editor (Cursor, Claude, Antigravity)
1. **Fully restart the editor** (close and reopen).
2. Open any project and ask:
   > "What projects are available to log time to in the analytics tracker?"
   
   *or*
   
   > "Log 1h on Analytics for client Carpe Diem testing MCP setup."
3. The AI should use the `log_work` tool directly and reply with the confirmed log details and updated daily total.

### Test 3: Testing Automatic Git Commit / Push Logging
1. Open any repository connected to a project in the Analytics System (e.g. `admin-portal` under `Carpe Diem`).
2. Make any small change and commit:
   ```bash
   git commit -m "feat(ui): test commit auto logging"
   ```
3. You will immediately see the hook output in your terminal:
   ```bash
   ✔ [Analytics] Logged 0.75h to Admin Portal (Carpe Diem) | Today's Total: 3.5h
   ```
4. Check `http://localhost:3000` (or your live Analytics URL) — the work log and commit will appear instantly in the project and developer dashboards!


---

## 6. Troubleshooting & Common Issues

<details>
<summary><h3>Issue 1: <code>node: command not found</code> in GUI Apps</h3></summary>

#### Symptom:
Claude Desktop or Cursor reports `Error: spawn node ENOENT` or fails to start the MCP server.

#### Cause:
On macOS and Windows, GUI apps launched from desktop icons, the Dock, or Spotlight do not inherit shell environment variables defined in `.zshrc`, `.bash_profile`, or non-system paths (especially when using version managers like `nvm`, `fnm`, or `asdf`).

#### Solution:
Replace the bare `"command": "node"` with the full absolute path to the Node binary:

- **macOS (Terminal):**
  Run:
  ```bash
  which node
  ```
  - Apple Silicon Homebrew: `/opt/homebrew/bin/node`
  - Intel Homebrew / Installer: `/usr/local/bin/node`
  - NVM: `/Users/username/.nvm/versions/node/v20.x.x/bin/node`

  Update your `mcp_config.json` / `mcp.json`:
  ```json
  "command": "/opt/homebrew/bin/node"
  ```

- **Windows (Command Prompt / PowerShell):**
  Run:
  ```cmd
  where.exe node
  ```
  Example output: `C:\Program Files\nodejs\node.exe`

  Update your configuration:
  ```json
  "command": "C:\\Program Files\\nodejs\\node.exe"
  ```
</details>

<details>
<summary><h3>Issue 2: Windows JSON Backslash Escaping</h3></summary>

#### Symptom:
Editor throws `SyntaxError: Unexpected token \ in JSON at position ...` when opening MCP settings.

#### Cause:
In JSON strings, a single backslash `\` is an escape character. Windows paths like `C:\Users\Jay\...` are invalid JSON.

#### Solution:
Always use forward slashes `/` (Node.js and Windows APIs natively understand forward slashes):
```json
"args": [
  "C:/Users/Jay/mcp-servers/tracker-mcp/build/index.js"
]
```
Or double-escape backslashes:
```json
"args": [
  "C:\\Users\\Jay\\mcp-servers\\tracker-mcp\\build\\index.js"
]
```
</details>

<details>
<summary><h3>Issue 3: PowerShell Execution Policy Restrictions</h3></summary>

#### Symptom:
On Windows PowerShell, running `npm run build` or `npx` produces:
`File ... cannot be loaded because running scripts is disabled on this system.`

#### Solution:
Open PowerShell as Current User and allow signed local scripts:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Or for the current session only:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
</details>

<details>
<summary><h3>Issue 4: AI Assistant Does Not Detect New Tools</h3></summary>

#### Symptom:
You updated the config file, but asking the AI to log work still uses bash or says no tool is found.

#### Solution:
AI editors only load MCP configurations on startup or explicit window reload:
1. **Cursor**: Press `Ctrl + Shift + P` (Windows) or `Cmd + Shift + P` (macOS), type `Developer: Reload Window`, and hit Enter.
2. **Claude Desktop**: Completely quit Claude (`Cmd + Q` on macOS, or right-click tray icon > Quit on Windows), then restart it.
3. **Antigravity CLI**: Exit the active `agy` session (`Ctrl + C` or type `exit`), then launch `agy` again.
4. **Check logs**:
   - In Cursor: Go to `Output` tab at the bottom and select `Cursor MCP` or `context-servers` from the dropdown to see any startup errors.
</details>

<details>
<summary><h3>Issue 5: API Connection or VPN Issues</h3></summary>

#### Symptom:
MCP tool is invoked, but returns `Failed to fetch` or `Network timeout`.

#### Solution:
1. Test network access to the API endpoint:
   ```bash
   curl -I https://analytics-two-ashen.vercel.app/api/projects
   ```
   Should return `HTTP/2 200`.
2. If working through a corporate proxy or VPN (like ProtonVPN, Zscaler, Cisco AnyConnect), verify that outgoing HTTPS requests to `*.vercel.app` are not blocked.
</details>

<details>
<summary><h3>Issue 6: Developer Name & Client Name Matching</h3></summary>

#### How Name Resolution Works:
- **Developer Name**: Configured via `DEVELOPER_NAME` environment variable in the config. The API matches names case-insensitively (e.g. `Jay` matches `jay` or `dev-jay`).
- **Client Name**: The MCP server features built-in fuzzy matching. If you type `"Carpe Diam"` or `"carpediem"`, it automatically normalizes and matches to `"Carpe Diem"`.
- **Category Resolution**: If you say "fixing bug", it maps to category `"Bugs/Fix"`; if you say "testing", it maps to `"Testing"`; "meetings" maps to `"Meeting"`, etc.
</details>
