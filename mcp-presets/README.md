# MCP (Model Context Protocol) Setup Guide

This guide explains how to connect your AI assistant (Cursor, Claude Desktop, Google Antigravity, VS Code / Continue, Windsurf, Zed) to the **Project Analytics MCP Server**.

---

## Prerequisites
1. Ensure the Analytics backend is running:
   ```bash
   npm run dev
   # or production server
   npm start
   ```
   (Default endpoint: `http://localhost:3000/api`)

2. Build the MCP Server package:
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

---

## Configuration Presets

### 1. Cursor (`.cursor/mcp.json` or Cursor Settings)
Navigate to **Cursor Settings > Features > MCP**, or add `.cursor/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": ["<WORKSPACE_PATH>/mcp-server/build/index.js"],
      "env": {
        "TRACKER_API_URL": "http://localhost:3000/api",
        "DEVELOPER_NAME": "Your Name"
      }
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)
Add the following to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": ["<WORKSPACE_PATH>/mcp-server/build/index.js"],
      "env": {
        "TRACKER_API_URL": "http://localhost:3000/api",
        "DEVELOPER_NAME": "Your Name"
      }
    }
  }
}
```

### 3. Google Antigravity / Gemini CLI (`.agents/mcp_config.json`)
Antigravity automatically discovers `.agents/mcp_config.json` from the repository root:

```json
{
  "mcpServers": {
    "project-analytics": {
      "command": "node",
      "args": ["<WORKSPACE_PATH>/mcp-server/build/index.js"],
      "env": {
        "TRACKER_API_URL": "http://localhost:3000/api",
        "DEVELOPER_NAME": "Your Name"
      }
    }
  }
}
```

### 4. VS Code (Continue / Roo-Code / Cline)
In your Cline / Roo Code / Continue MCP settings:

```json
{
  "project-analytics": {
    "command": "node",
    "args": ["<WORKSPACE_PATH>/mcp-server/build/index.js"],
    "env": {
      "TRACKER_API_URL": "http://localhost:3000/api",
      "DEVELOPER_NAME": "Your Name"
    }
  }
}
```

---

## Available Tools

1. **`log_work`**: Logs hours and task descriptions into the system.
   - Example prompt: *"Log 2.5 hours on Ring Configurator fixing shadow map artifacts under Frontend"*
2. **`list_projects`**: Lists all active projects and codes.
   - Example prompt: *"What projects are available to log time against?"*
3. **`list_categories`**: Lists standard accepted work categories.
   - Example prompt: *"What are the standard categories for work logs?"*
4. **`get_my_logs`**: Checks your recent logged hours and total for today.
   - Example prompt: *"Show me the work I logged today and my total hours."*
