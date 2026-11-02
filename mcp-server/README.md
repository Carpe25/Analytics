# Tracker MCP Server

Model Context Protocol (MCP) server for logging work and developer hours directly to the Analytics System through AI assistants (Cursor, Claude Desktop, Antigravity, Windsurf, VS Code).

## Quick Setup for Developers

### Step 1: Install Globally from Private Git Repo
```bash
# Using SSH (recommended)
npm install -g git+ssh://git@github.com:Carpe25/tracker-mcp.git

# Or using HTTPS
npm install -g https://github.com/Carpe25/tracker-mcp.git
```

### Step 2: Run Auto-Setup
```bash
carpe-tracker setup --name "Your Name"
```
*(Or simply run `tracker-mcp setup` to be prompted interactively for your name and optional API key).*

That's it! The command automatically configures:
- **Cursor** (`~/.cursor/mcp.json` & global storage)
- **Claude Desktop**
- **Antigravity / Gemini CLI**
- **Windsurf**
- **VS Code (Cline)**

### Step 3: Start Logging in Any Project!
Open any project in Cursor, Claude, or Antigravity and prompt your AI:
> "Log 2 hours on CAD Portal for client Carpe Diam fixing login bug under Bugs/Fix"

---

## Manual IDE Configuration (If Not Using Auto-Setup)

Add this block to your IDE's MCP settings:

```

---

## Automatic Git Commit & Push Logging

The Tracker MCP can automatically log your work whenever you commit or push code!

### How It Works:
1. **Connected Project & Client Detection**: The hook detects your repository from `git remote get-url origin` (e.g. `Carpe25/admin-portal`), finds which project has that repository connected in the Analytics System, and automatically logs the work to that **exact project and client** (e.g., **Admin Portal** under **Carpe Diem**).
2. **Dynamic Time Calculation**: It queries your previous commit timestamp across all tracked repositories and computes the elapsed time automatically.
3. **Smart Guardrails**:
   - Overnight gaps (> 4h) are clamped to a default 45-minute session instead of logging idle hours.
   - Micro-commits (< 5m) are floored to a 10-minute minimum.
   - Category is inferred from your Conventional Commit prefix (`feat:`, `fix:`, `api:`, `docs:`, etc.).

### Installation Options:

#### Option A: Install Globally (Works for all repositories on your computer)
```bash
node build/index.js install-hook --global
```
*(Sets `git config --global core.hooksPath ~/.git-tracker-hooks`).*

#### Option B: Install for Current Repository Only
```bash
node build/index.js install-hook
```
*(Installs directly into `.git/hooks/post-commit`).*

#### Option C: Log via AI Assistant Tools in Cursor / Claude / Antigravity
You can also ask your AI assistant:
> "Log my last git commit"
The assistant will execute the `log_git_commit` MCP tool, inspect the repository, calculate elapsed time, and log the work entry automatically!
