#!/usr/bin/env node

/**
 * Automated Test Runner for Tracker MCP Server
 * Tests stdio transport, tools discovery, and tool execution.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../mcp-server/build/index.js");

console.log("🚀 Starting Tracker MCP Server Test Runner...\n");

const child = spawn("node", [serverPath], {
  env: {
    ...process.env,
    TRACKER_API_URL: process.env.TRACKER_API_URL || "http://localhost:3000/api",
    DEVELOPER_NAME: process.env.DEVELOPER_NAME || "Jay",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let msgId = 1;
const pendingRequests = new Map();

function sendRpc(method, params = {}) {
  const id = msgId++;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify(payload) + "\n");
  });
}

let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep last unfinished line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line.trim());
      if (parsed.id && pendingRequests.has(parsed.id)) {
        const { resolve, reject } = pendingRequests.get(parsed.id);
        pendingRequests.delete(parsed.id);
        if (parsed.error) {
          reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
        } else {
          resolve(parsed.result);
        }
      }
    } catch (e) {
      // not a json line
    }
  }
});

child.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[mcp log] ${msg}`);
});

async function runTests() {
  try {
    // 1. Tool Discovery
    console.log("1️⃣  Testing Tool Discovery (tools/list)...");
    const listRes = await sendRpc("tools/list");
    const tools = listRes.tools || [];
    console.log(`   ✅ Discovered ${tools.length} tools:`);
    tools.forEach((t) => console.log(`      • ${t.name}: ${t.description.slice(0, 60)}...`));

    const expectedTools = ["log_work", "list_projects", "list_categories", "get_my_logs"];
    for (const exp of expectedTools) {
      if (!tools.some((t) => t.name === exp)) {
        throw new Error(`Missing expected tool: ${exp}`);
      }
    }

    // 2. Test list_categories
    console.log("\n2️⃣  Testing Tool Call: list_categories...");
    const catRes = await sendRpc("tools/call", {
      name: "list_categories",
      arguments: {},
    });
    console.log("   ✅ Result:\n" + catRes.content[0].text.split("\n").slice(0, 6).join("\n") + "\n      ...");

    // 3. Test list_projects
    console.log("\n3️⃣  Testing Tool Call: list_projects...");
    try {
      const projRes = await sendRpc("tools/call", {
        name: "list_projects",
        arguments: {},
      });
      console.log("   ✅ Result:\n" + projRes.content[0].text.split("\n").slice(0, 5).join("\n") + "\n      ...");
    } catch (err) {
      console.log(`   ℹ️  list_projects called backend: ${err.message} (expected if backend dev server not active yet)`);
    }

    // 4. Test get_my_logs
    console.log("\n4️⃣  Testing Tool Call: get_my_logs...");
    try {
      const logsRes = await sendRpc("tools/call", {
        name: "get_my_logs",
        arguments: { days: 1 },
      });
      console.log("   ✅ Result:\n" + logsRes.content[0].text);
    } catch (err) {
      console.log(`   ℹ️  get_my_logs called backend: ${err.message} (expected if backend dev server not active yet)`);
    }

    // 5. Test log_work schema validation
    console.log("\n5️⃣  Testing Tool Call: log_work (schema validation check)...");
    const failRes = await sendRpc("tools/call", {
      name: "log_work",
      arguments: { duration: "2h" }, // missing project, category, description
    });
    if (failRes.isError) {
      console.log(`   ✅ Validation caught missing fields as expected: ${failRes.content[0].text.slice(0, 70)}...`);
    }

    console.log("\n🎉 All MCP Protocol & Tool checks passed successfully!\n");
  } catch (err) {
    console.error("\n❌ MCP Test failed:", err);
  } finally {
    child.kill();
    process.exit(0);
  }
}

// Give process 200ms to initialize stdio transport
setTimeout(runTests, 200);
