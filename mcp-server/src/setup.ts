import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { installGitHook } from "./git-hook.js";

interface SetupOptions {
  developerName: string;
  apiUrl: string;
  apiKey?: string;
}

const DEFAULT_API_URL = "https://analytics-two-ashen.vercel.app/api";

function getHomeDir(): string {
  return os.homedir();
}

function getEditorConfigPaths(): Array<{ name: string; path: string; isZed?: boolean }> {
  const home = getHomeDir();
  const platform = process.platform;
  const paths: Array<{ name: string; path: string; isZed?: boolean }> = [];

  // 1. Cursor Global & Local
  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    paths.push({
      name: "Cursor (Global)",
      path: path.join(appData, "Cursor", "User", "globalStorage", "cursor.mcp", "mcp.json"),
    });
  } else if (platform === "darwin") {
    paths.push({
      name: "Cursor (Global)",
      path: path.join(
        home,
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage",
        "cursor.mcp",
        "mcp.json"
      ),
    });
  } else {
    paths.push({
      name: "Cursor (Global)",
      path: path.join(
        home,
        ".config",
        "Cursor",
        "User",
        "globalStorage",
        "cursor.mcp",
        "mcp.json"
      ),
    });
  }
  // Cursor home shorthand
  paths.push({
    name: "Cursor (~/.cursor/mcp.json)",
    path: path.join(home, ".cursor", "mcp.json"),
  });

  // 2. Claude Desktop
  if (platform === "darwin") {
    paths.push({
      name: "Claude Desktop",
      path: path.join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      ),
    });
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    paths.push({
      name: "Claude Desktop",
      path: path.join(appData, "Claude", "claude_desktop_config.json"),
    });
  } else {
    paths.push({
      name: "Claude Desktop",
      path: path.join(home, ".config", "Claude", "claude_desktop_config.json"),
    });
  }

  // 3. Windsurf
  paths.push({
    name: "Windsurf",
    path: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
  });

  // 4. Cline (VS Code Extension)
  if (platform === "darwin") {
    paths.push({
      name: "VS Code Cline",
      path: path.join(
        home,
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json"
      ),
    });
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    paths.push({
      name: "VS Code Cline",
      path: path.join(
        appData,
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json"
      ),
    });
  } else {
    paths.push({
      name: "VS Code Cline",
      path: path.join(
        home,
        ".config",
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json"
      ),
    });
  }

  // 5. Zed Editor
  paths.push({
    name: "Zed Editor",
    path: path.join(home, ".config", "zed", "settings.json"),
    isZed: true,
  });

  // 6. Antigravity / Gemini CLI (Global & Snap)
  paths.push({
    name: "Antigravity (Global Config)",
    path: path.join(home, ".gemini", "config", "mcp_config.json"),
  });
  paths.push({
    name: "Antigravity (Global App)",
    path: path.join(home, ".gemini", "antigravity-cli", "mcp_config.json"),
  });
  if (platform === "linux") {
    paths.push({
      name: "Antigravity (Snap Global Config)",
      path: path.join(home, "snap", "antigravity-cli", "common", ".gemini", "config", "mcp_config.json"),
    });
    paths.push({
      name: "Antigravity (Snap App)",
      path: path.join(home, "snap", "antigravity-cli", "common", ".gemini", "antigravity-cli", "mcp_config.json"),
    });
  }

  // Current project directory (if .agents or .cursor exists)
  const cwd = process.cwd();
  paths.push({
    name: "Workspace (.agents/mcp_config.json)",
    path: path.join(cwd, ".agents", "mcp_config.json"),
  });
  paths.push({
    name: "Workspace (.cursor/mcp.json)",
    path: path.join(cwd, ".cursor", "mcp.json"),
  });

  return paths;
}

function prompt(rl: readline.Interface, question: string, defaultValue: string = ""): Promise<string> {
  const displayPrompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(displayPrompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function updateConfigFile(filePath: string, serverName: string, serverConfig: any, isZed: boolean = false): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (isZed) {
      let existingData: any = {};
      if (fs.existsSync(filePath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch {
          existingData = {};
        }
      }
      if (!existingData.context_servers || typeof existingData.context_servers !== "object") {
        existingData.context_servers = {};
      }
      existingData.context_servers[serverName] = {
        command: {
          path: serverConfig.command || "node",
          args: serverConfig.args || [],
          env: serverConfig.env || {},
        },
      };
      fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2) + "\n", "utf-8");
      return true;
    }

    let existingData: any = { mcpServers: {} };
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        existingData = JSON.parse(raw);
        if (!existingData.mcpServers || typeof existingData.mcpServers !== "object") {
          existingData.mcpServers = {};
        }
      } catch {
        existingData = { mcpServers: {} };
      }
    }

    existingData.mcpServers[serverName] = serverConfig;

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2) + "\n", "utf-8");
    return true;
  } catch (err: any) {
    return false;
  }
}

export async function runSetup() {
  console.log("\n🚀 Carpe Analytics MCP Auto-Setup");
  console.log("=====================================\n");
  console.log("This will configure your AI coding assistants (Cursor, Claude, Antigravity, Windsurf, etc.)");
  console.log("to automatically log work to the Analytics System.\n");

  const args = process.argv.slice(2);
  let developerName = "";
  let apiUrl = DEFAULT_API_URL;
  let apiKey = "";

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--name" || args[i] === "-n") && args[i + 1]) {
      developerName = args[i + 1];
      i++;
    } else if (args[i] === "--url" && args[i + 1]) {
      apiUrl = args[i + 1];
      i++;
    } else if (args[i] === "--key" && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    }
  }

  // If not passed via args, prompt interactively
  if (!developerName && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const defaultDevName = process.env.DEVELOPER_NAME || os.userInfo().username || "Developer";
    developerName = await prompt(rl, "Enter your Developer Name (e.g. Jay, John, Alex)", defaultDevName);
    apiUrl = await prompt(rl, "Analytics API URL", apiUrl);
    apiKey = await prompt(rl, "API Key (optional, press Enter to skip)", apiKey);

    rl.close();
  } else if (!developerName) {
    developerName = process.env.DEVELOPER_NAME || os.userInfo().username || "Developer";
  }

  console.log(`\nConfiguring for:`);
  console.log(`  • Developer: ${developerName}`);
  console.log(`  • API URL:   ${apiUrl}`);
  if (apiKey) console.log(`  • API Key:   [Provided]`);
  console.log("");

  const envConfig: Record<string, string> = {
    TRACKER_API_URL: apiUrl,
    DEVELOPER_NAME: developerName,
  };
  if (apiKey) {
    envConfig.TRACKER_API_KEY = apiKey;
  }

  // Smart executable determination:
  // If run via globally installed binary or local node file, use direct node path
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  let serverConfig: { command: string; args: string[]; env: Record<string, string> };

  if (scriptPath && fs.existsSync(scriptPath) && scriptPath.endsWith(".js")) {
    serverConfig = {
      command: "node",
      args: [scriptPath],
      env: envConfig,
    };
  } else {
    serverConfig = {
      command: "npx",
      args: ["-y", "carpe-tracker"],
      env: envConfig,
    };
  }

  const targets = getEditorConfigPaths();
  let configuredCount = 0;

  for (const target of targets) {
    const parentDir = path.dirname(target.path);
    // Only write to directories that either already exist or are standard home configs
    const shouldWrite =
      fs.existsSync(parentDir) ||
      target.path.includes(".cursor") ||
      target.path.includes("Claude") ||
      target.path.includes(".codeium") ||
      target.path.includes(".agents") ||
      target.path.includes("zed");

    if (shouldWrite) {
      const ok = updateConfigFile(target.path, "project-analytics", serverConfig, target.isZed);
      if (ok) {
        console.log(`  ✅ Configured ${target.name} -> ${target.path}`);
        configuredCount++;
      }
    }
  }

  // Automatically install global Git auto-logger hook
  if (!args.includes("--no-hook")) {
    console.log(`\nConfiguring Global Git Auto-Logger Hook:`);
    try {
      installGitHook({ global: true });
    } catch (hookErr: any) {
      console.warn(`  ⚠️ Could not install global Git hook: ${hookErr.message}`);
    }
  }

  console.log(`\n🎉 Success! Configured ${configuredCount} AI assistant target(s) and Global Git Hook.`);
  console.log("\nNext Steps:");
  console.log("1. Restart your AI editor (Cursor / Claude Desktop / Antigravity).");
  console.log("2. Automatic Git Logging is ACTIVE: Any commit or push in connected repositories will automatically log time to the respective project and client!");
  console.log('3. You can also prompt your AI in any project: "Log 1h on Analytics for client Carpe Diam working on setup."\n');
}
