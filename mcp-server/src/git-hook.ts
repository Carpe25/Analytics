import fs from "fs";
import path from "path";
import os from "os";
import { TrackerApiClient } from "./api-client.js";
import { autoLogCurrentGitCommit, runGitCommand } from "./git-engine.js";

export async function handleGitHookExecution(args: string[]) {
  const client = new TrackerApiClient();
  const hookType = args[0] || "post-commit";

  try {
    const res = await autoLogCurrentGitCommit(client);
    if (res && res.workLog) {
      const log = res.workLog;
      const hours = log.hours;
      const proj = log.projectName;
      const clientName = log.client ? ` (${log.client})` : "";
      const total = res.developerTotalHoursToday ? ` | Today's Total: ${res.developerTotalHoursToday}h` : "";

      console.log(`\x1b[32m✔ [Analytics]\x1b[0m Logged \x1b[1m${hours}h\x1b[0m to \x1b[36m${proj}${clientName}\x1b[0m${total}`);
    }
  } catch (err: any) {
    // Non-blocking: Print brief warning but never fail the Git commit/push
    console.warn(`\x1b[33m⚠ [Analytics]\x1b[0m Auto-logging commit: ${err.message}`);
  }
}

export interface InstallHookOptions {
  global?: boolean;
  hookName?: "post-commit" | "pre-push";
}

export function installGitHook(options: InstallHookOptions = {}) {
  const scriptPath = path.resolve(__dirname, "index.js");
  const safeScriptPath = scriptPath.replace(/\\/g, "/");
  const hookName = options.hookName || "post-commit";

  const hookContent = `#!/usr/bin/env bash
# Carpe Analytics MCP Auto-Logger
# Automatically logs time on git commit/push to connected projects

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  TRACKER_SCRIPT="${safeScriptPath}"
  if [ -f "$TRACKER_SCRIPT" ]; then
    "$NODE_BIN" "$TRACKER_SCRIPT" git-hook "${hookName}"
  fi
fi
`;

  if (options.global) {
    const homeDir = os.homedir();
    const globalHooksDir = path.join(homeDir, ".git-tracker-hooks");

    if (!fs.existsSync(globalHooksDir)) {
      fs.mkdirSync(globalHooksDir, { recursive: true });
    }

    const targetHookFile = path.join(globalHooksDir, hookName);
    fs.writeFileSync(targetHookFile, hookContent, { mode: 0o755 });

    // Set git config --global core.hooksPath
    runGitCommand(`config --global core.hooksPath "${globalHooksDir}"`);

    console.log(`\x1b[32m✔ Global Git hook installed successfully!\x1b[0m`);
    console.log(`• Hook Location: ${targetHookFile}`);
    console.log(`• Git Config: core.hooksPath = ${globalHooksDir}`);
    console.log(`• Every repository on your machine will now automatically log work to connected projects on ${hookName}.`);
  } else {
    // Local repository hook
    const isGit = runGitCommand("rev-parse --is-inside-work-tree");
    if (isGit !== "true") {
      throw new Error("Current directory is not a Git repository. Use --global to install globally across all projects.");
    }

    const gitDir = runGitCommand("rev-parse --git-dir");
    const hooksDir = path.resolve(process.cwd(), gitDir, "hooks");

    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const targetHookFile = path.join(hooksDir, hookName);
    fs.writeFileSync(targetHookFile, hookContent, { mode: 0o755 });

    console.log(`\x1b[32m✔ Local Git hook installed successfully in current repository!\x1b[0m`);
    console.log(`• Hook Location: ${targetHookFile}`);
    console.log(`• Commits in this repository will now automatically log work to the connected project.`);
  }
}
