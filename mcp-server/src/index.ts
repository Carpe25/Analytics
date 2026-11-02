#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { TrackerApiClient } from "./api-client.js";
import { TOOLS_DEFINITIONS, handleToolCall } from "./tools.js";
import { runSetup } from "./setup.js";
import { handleGitHookExecution, installGitHook } from "./git-hook.js";

async function main() {
  if (process.argv.includes("setup") || process.argv.includes("--setup") || process.argv.includes("init")) {
    await runSetup();
    return;
  }

  if (process.argv.includes("install-hook") || process.argv.includes("install-git-hook")) {
    const isGlobal = process.argv.includes("--global");
    const isPrePush = process.argv.includes("--pre-push");
    installGitHook({
      global: isGlobal,
      hookName: isPrePush ? "pre-push" : "post-commit",
    });
    return;
  }

  if (process.argv.includes("git-hook") || process.argv.includes("--git-hook")) {
    const hookIdx = process.argv.findIndex((a) => a === "git-hook" || a === "--git-hook");
    const hookArgs = process.argv.slice(hookIdx + 1);
    await handleGitHookExecution(hookArgs);
    return;
  }

  const server = new Server(
    {
      name: "tracker-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const client = new TrackerApiClient();

  // Handle tools listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS_DEFINITIONS,
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await handleToolCall(client, name, args);
    } catch (err: any) {
      console.error(`[tracker-mcp] Error executing tool ${name}:`, err.message);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Error: ${err.message}`,
          },
        ],
      };
    }
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[tracker-mcp] Server running on stdio transport.");

  process.on("SIGINT", async () => {
    console.error("[tracker-mcp] Shutting down on SIGINT...");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("[tracker-mcp] Shutting down on SIGTERM...");
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[tracker-mcp] Fatal error:", err);
  process.exit(1);
});
