import { z } from "zod";
import { TrackerApiClient } from "./api-client.js";
import { autoLogCurrentGitCommit, getGitCommitContext } from "./git-engine.js";

export const LogWorkInputSchema = z.object({
  project: z.string().describe("Project name, code, or alias (e.g., 'Ring Configurator', 'CAD Portal', 'CORE', 'Medusajs'). Fuzzy matched."),
  client: z.string().optional().describe("Optional client name to disambiguate projects (e.g., 'Carpe Diem', 'Universal Diamonds', 'Effision', 'Level Up', 'Lumen')."),
  duration: z.union([z.string(), z.number()]).describe("Time spent on the task (e.g. '2.5h', '2h 15m', '90m', '1.5', '1:30')."),
  category: z.string().describe("Work category (e.g., 'Frontend', 'Backend', 'Bug Fix', 'Code Review', 'Meeting', 'DevOps', 'Design')."),
  description: z.string().describe("Detailed description of work performed."),
  developerName: z.string().optional().describe("Developer name or email. If omitted, defaults to DEVELOPER_NAME environment variable."),
  taskTicketId: z.string().optional().describe("Ticket/Issue ID if applicable (e.g. 'ENG-104', 'PROJ-42')."),
  date: z.string().optional().describe("Work date in YYYY-MM-DD format. Defaults to current date."),
});

export const ListProjectsInputSchema = z.object({});

export const ListCategoriesInputSchema = z.object({});

export const GetMyLogsInputSchema = z.object({
  developerName: z.string().optional().describe("Developer name or email. Defaults to DEVELOPER_NAME environment variable."),
  days: z.number().optional().describe("Number of past days to query (default: 1 for today)."),
});

export const LogGitCommitInputSchema = z.object({
  cwd: z.string().optional().describe("Optional repository path (defaults to current working directory)."),
  category: z.string().optional().describe("Optional category override (e.g. Frontend, Backend, Bug Fix). Inferred from commit message if omitted."),
  project: z.string().optional().describe("Optional project override. Automatically resolved from connected GitHub repo if omitted."),
  client: z.string().optional().describe("Optional client override (e.g. 'Carpe Diem')."),
});

export const GetLastCommitInfoInputSchema = z.object({
  cwd: z.string().optional().describe("Optional repository path (defaults to current working directory)."),
});

export const TOOLS_DEFINITIONS = [
  {
    name: "log_work",
    description: "Logs developer hours and task details into the Project Analytics System with instant cache update and fuzzy project resolution.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name, code, or alias (e.g., 'Ring Configurator', 'CAD Portal', 'Custom Portal'). Fuzzy matched.",
        },
        client: {
          type: "string",
          description: "Optional client name to disambiguate projects (e.g., 'Carpe Diem', 'Universal Diamonds', 'Effision', 'Lumen').",
        },
        duration: {
          type: "string",
          description: "Time spent (e.g., '2.5h', '2h 15m', '90m', '1.5', '1:30').",
        },
        category: {
          type: "string",
          description: "Work category (e.g., 'Frontend', 'Backend', 'Bug Fix', 'Code Review', 'Meeting', 'DevOps', 'Design').",
        },
        description: {
          type: "string",
          description: "Detailed description of work performed.",
        },
        developerName: {
          type: "string",
          description: "Developer name or email. Defaults to DEVELOPER_NAME environment variable if not specified.",
        },
        taskTicketId: {
          type: "string",
          description: "Optional Ticket/Issue ID (e.g., 'ENG-104', 'PROJ-42').",
        },
        date: {
          type: "string",
          description: "Optional work date in YYYY-MM-DD format. Defaults to current date.",
        },
      },
      required: ["project", "duration", "category", "description"],
    },
  },
  {
    name: "list_projects",
    description: "Returns all active projects and their associated clients and codes to assist with autocompletion and project selection.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_categories",
    description: "Returns the standardized list of task categories accepted by the Project Analytics System.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_my_logs",
    description: "Allows developers to query their recent work submissions, hours, and daily aggregate totals.",
    inputSchema: {
      type: "object",
      properties: {
        developerName: {
          type: "string",
          description: "Optional developer name. Defaults to configured developer identity.",
        },
        days: {
          type: "number",
          description: "Number of past days to query (default: 1 for today).",
        },
      },
    },
  },
  {
    name: "log_git_commit",
    description: "Automatically logs work into the Analytics System from the latest Git commit in the repository, calculating elapsed time from the developer's last commit and matching the connected project and client.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Optional repository directory path (defaults to current working directory).",
        },
        category: {
          type: "string",
          description: "Optional category override (e.g. Frontend, Backend, Bug Fix). Inferred from commit message if omitted.",
        },
        project: {
          type: "string",
          description: "Optional project override. Automatically resolved from connected GitHub repo if omitted.",
        },
        client: {
          type: "string",
          description: "Optional client override (e.g. 'Carpe Diem').",
        },
      },
    },
  },
  {
    name: "get_last_commit_info",
    description: "Inspects the latest Git commit in the repository, showing author, commit timestamp, connected project, and previous commit interval.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Optional repository directory path (defaults to current working directory).",
        },
      },
    },
  },
];

export async function handleToolCall(client: TrackerApiClient, name: string, args: unknown) {
  switch (name) {
    case "log_work": {
      const parsed = LogWorkInputSchema.parse(args);
      const res = await client.logWork(parsed);
      const log = res.log;
      return {
        content: [
          {
            type: "text",
            text: [
              `✅ ${res.message}`,
              "",
              `• Work Log ID: ${log.id}`,
              `• Date: ${log.date}`,
              `• Developer: ${log.developerName} (${log.developerId})`,
              `• Project: ${log.projectName} [Client: ${log.client}]`,
              `• Category: ${log.category}`,
              `• Duration: ${log.hours}h (${log.durationMinutes} mins)`,
              log.taskTicketId ? `• Ticket: ${log.taskTicketId}` : null,
              `• Description: ${log.description}`,
              "",
              `📊 Developer Total Today: ${res.developerTotalHoursToday} hours`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    }

    case "list_projects": {
      const projects = await client.listProjects();
      const formatted = projects.map(
        (p: any) => `• ${p.name} [ID: ${p.id}${p.code ? `, Code: ${p.code}` : ""}] (Client: ${p.client})`
      );

      return {
        content: [
          {
            type: "text",
            text: [
              `📁 Active Projects in Analytics System (${projects.length}):`,
              "",
              ...formatted,
            ].join("\n"),
          },
        ],
      };
    }

    case "list_categories": {
      const categories = await client.listCategories();
      return {
        content: [
          {
            type: "text",
            text: [
              `🏷️ Standard Task Categories:`,
              "",
              ...categories.map((c) => `• ${c}`),
            ].join("\n"),
          },
        ],
      };
    }

    case "get_my_logs": {
      const parsed = GetMyLogsInputSchema.parse(args || {});
      const days = parsed.days || 1;
      const res = await client.getMyLogs(parsed.developerName, days);
      const logs = res.logs || [];

      if (logs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No work logs found for the requested period (last ${days} day(s)). Total logged: 0 hours.`,
            },
          ],
        };
      }

      const logLines = logs.map(
        (l: any) =>
          `• [${l.date}] ${l.hours}h on ${l.projectName} (${l.category}): ${l.description}${
            l.taskTicketId ? ` [${l.taskTicketId}]` : ""
          }`
      );

      return {
        content: [
          {
            type: "text",
            text: [
              `📋 Recent Work Logs (${logs.length} entries, ${res.totalHours} total hours):`,
              "",
              ...logLines,
              "",
              `Total: ${res.totalHours} hours across ${logs.length} logged tasks.`,
            ].join("\n"),
          },
        ],
      };
    }

    case "log_git_commit": {
      const parsed = LogGitCommitInputSchema.parse(args || {});
      const res = await autoLogCurrentGitCommit(client, parsed);
      const log = res.workLog;
      return {
        content: [
          {
            type: "text",
            text: [
              `✅ ${res.message}`,
              "",
              `• Work Log ID: ${log.id}`,
              `• Commit: ${res.commit?.shortSha || "HEAD"} - "${log.description}"`,
              `• Project: ${log.projectName} [Client: ${log.client}]`,
              `• Category: ${log.category}`,
              `• Duration: ${log.hours}h (${log.durationMinutes} mins) [Rule: ${res.calculation?.ruleApplied || "calculated"}]`,
              log.taskTicketId ? `• Ticket: ${log.taskTicketId}` : null,
              `• Developer: ${log.developerName}`,
              "",
              `📊 Developer Total Today: ${res.developerTotalHoursToday} hours`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    }

    case "get_last_commit_info": {
      const parsed = GetLastCommitInfoInputSchema.parse(args || {});
      const ctx = getGitCommitContext(parsed.cwd);
      if (!ctx.isGitRepo) {
        return {
          content: [
            {
              type: "text",
              text: "Current directory is not a Git repository.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: [
              `🔍 Git Commit Context:`,
              `• Repo: ${ctx.repoFullName || "local"} (Branch: ${ctx.branch || "unknown"})`,
              `• Latest Commit: ${ctx.shortSha || "none"}`,
              `• Message: ${ctx.message?.split("\n")[0] || "none"}`,
              `• Author: ${ctx.authorName || "unknown"} <${ctx.authorEmail || ""}>`,
              `• Commit Timestamp: ${ctx.commitTimestamp ? new Date(ctx.commitTimestamp * 1000).toISOString() : "unknown"}`,
              `• Previous Author Commit: ${ctx.previousCommitTimestamp ? new Date(ctx.previousCommitTimestamp * 1000).toISOString() : "none in local history"}`,
            ].join("\n"),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
