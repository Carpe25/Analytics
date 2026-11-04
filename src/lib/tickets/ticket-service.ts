import fs from "fs/promises";
import path from "path";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { Ticket } from "@/types";

function getSql(): NeonQueryFunction<false, false> | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  return neon(dbUrl);
}

// In serverless (Vercel), only /tmp is writable. In local dev, use .artifacts.
const TICKETS_FILE = process.env.VERCEL
  ? path.join("/tmp", "tickets.json")
  : path.resolve(process.cwd(), ".artifacts", "tickets", "tickets.json");

async function ensureTicketsDir(): Promise<void> {
  try {
    const dir = path.dirname(TICKETS_FILE);
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Silently ignore mkdir errors in read-only environments
  }
}

async function readFileFallback(): Promise<Ticket[]> {
  try {
    const data = await fs.readFile(TICKETS_FILE, "utf8");
    return JSON.parse(data) as Ticket[];
  } catch {
    return [];
  }
}

async function writeFileFallback(tickets: Ticket[]): Promise<void> {
  try {
    await ensureTicketsDir();
    const tempPath = `${TICKETS_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(tickets, null, 2), "utf8");
    await fs.rename(tempPath, TICKETS_FILE);
  } catch (err) {
    console.warn("Could not write tickets fallback file:", err);
  }
}

async function ensureNeonTicketsTable(sql: NeonQueryFunction<false, false>): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(64) PRIMARY KEY,
        ticket_number VARCHAR(32) NOT NULL,
        client VARCHAR(255) NOT NULL,
        project_id VARCHAR(128) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        issue TEXT NOT NULL,
        photo_url TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'under_review',
        raised_by_name VARCHAR(255),
        reviewed_at TIMESTAMPTZ,
        reviewed_by VARCHAR(255),
        assigned_to_developer_id VARCHAR(64),
        assigned_to_developer_name VARCHAR(255),
        assigned_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        raw_json JSONB
      );
    `;
  } catch (err) {
    console.warn("Could not ensure tickets table in Neon:", err);
  }
}

export async function readTickets(): Promise<Ticket[]> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureNeonTicketsTable(sql);
      const rows = await sql`
        SELECT raw_json FROM tickets
        ORDER BY created_at DESC;
      `;
      if (rows && rows.length > 0) {
        return rows.map((r: any) =>
          typeof r.raw_json === "string" ? JSON.parse(r.raw_json) : r.raw_json
        );
      }
    } catch (err) {
      console.error("Error reading tickets from Neon database:", err);
    }
  }

  return readFileFallback();
}

export async function writeTickets(tickets: Ticket[]): Promise<void> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureNeonTicketsTable(sql);
      for (const t of tickets) {
        await sql`
          INSERT INTO tickets (
            id, ticket_number, client, project_id, project_name, issue, photo_url,
            status, raised_by_name, reviewed_by,
            assigned_to_developer_id, assigned_to_developer_name,
            created_at, updated_at, raw_json
          ) VALUES (
            ${t.id}, ${t.ticketNumber}, ${t.client}, ${t.projectId}, ${t.projectName}, ${t.issue},
            ${t.photoUrl || null}, ${t.status || "under_review"}, ${t.raisedByName || null},
            ${t.reviewedBy || null}, ${t.assignedToDeveloperId || null}, ${t.assignedToDeveloperName || null},
            ${t.createdAtUtc || new Date().toISOString()}, ${t.updatedAtUtc || new Date().toISOString()},
            ${JSON.stringify(t)}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            reviewed_by = EXCLUDED.reviewed_by,
            assigned_to_developer_id = EXCLUDED.assigned_to_developer_id,
            assigned_to_developer_name = EXCLUDED.assigned_to_developer_name,
            updated_at = NOW(),
            raw_json = EXCLUDED.raw_json;
        `;
      }
    } catch (err) {
      console.error("Error writing tickets to Neon:", err);
    }
  }

  await writeFileFallback(tickets);
}

export async function getNextTicketNumber(): Promise<string> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureNeonTicketsTable(sql);
      const rows = await sql`SELECT count(*) FROM tickets;`;
      const count = Number(rows[0]?.count || 0) + 1;
      return `TCK-${count.toString().padStart(3, "0")}`;
    } catch {}
  }

  const tickets = await readFileFallback();
  const count = tickets.length + 1;
  return `TCK-${count.toString().padStart(3, "0")}`;
}

export async function createTicket(input: {
  client: string;
  projectId: string;
  projectName: string;
  issue: string;
  photoUrl?: string;
  raisedByName?: string;
}): Promise<Ticket> {
  const ticketNumber = await getNextTicketNumber();
  const now = new Date().toISOString();

  const newTicket: Ticket = {
    id: `tick-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ticketNumber,
    client: input.client.trim(),
    projectId: input.projectId.trim(),
    projectName: input.projectName.trim(),
    issue: input.issue.trim(),
    photoUrl: input.photoUrl?.trim() || undefined,
    status: "under_review",
    raisedByName: input.raisedByName?.trim() || "Client / Guest",
    createdAtUtc: now,
    updatedAtUtc: now,
  };

  const sql = getSql();
  if (sql) {
    try {
      await ensureNeonTicketsTable(sql);
      await sql`
        INSERT INTO tickets (
          id, ticket_number, client, project_id, project_name, issue, photo_url,
          status, raised_by_name, created_at, updated_at, raw_json
        ) VALUES (
          ${newTicket.id}, ${newTicket.ticketNumber}, ${newTicket.client},
          ${newTicket.projectId}, ${newTicket.projectName}, ${newTicket.issue},
          ${newTicket.photoUrl || null}, ${newTicket.status}, ${newTicket.raisedByName || null},
          ${now}, ${now}, ${JSON.stringify(newTicket)}
        );
      `;
      // Also write to local cache if possible
      await writeFileFallback([newTicket, ...(await readFileFallback())]);
      return newTicket;
    } catch (err: any) {
      console.error("Error inserting ticket into Neon database:", err);
      // Fall through to fallback
    }
  }

  const tickets = await readFileFallback();
  tickets.unshift(newTicket);
  await writeFileFallback(tickets);
  return newTicket;
}

export async function makeTicketLive(
  ticketId: string,
  reviewerName: string = "Manager"
): Promise<Ticket | null> {
  const tickets = await readTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  tickets[index] = {
    ...tickets[index],
    status: "open",
    reviewedAtUtc: now,
    reviewedBy: reviewerName,
    updatedAtUtc: now,
  };

  await writeTickets(tickets);
  return tickets[index];
}

export async function assignTicket(
  ticketId: string,
  developerId: string,
  developerName: string
): Promise<Ticket | null> {
  const tickets = await readTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  tickets[index] = {
    ...tickets[index],
    status: "assigned",
    assignedToDeveloperId: developerId,
    assignedToDeveloperName: developerName,
    assignedAtUtc: now,
    updatedAtUtc: now,
  };

  await writeTickets(tickets);
  return tickets[index];
}

export async function unassignTicket(ticketId: string): Promise<Ticket | null> {
  const tickets = await readTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  tickets[index] = {
    ...tickets[index],
    status: "open",
    assignedToDeveloperId: undefined,
    assignedToDeveloperName: undefined,
    assignedAtUtc: undefined,
    updatedAtUtc: now,
  };

  await writeTickets(tickets);
  return tickets[index];
}

export async function resolveTicket(ticketId: string): Promise<Ticket | null> {
  const tickets = await readTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  tickets[index] = {
    ...tickets[index],
    status: "resolved",
    updatedAtUtc: now,
  };

  await writeTickets(tickets);
  return tickets[index];
}
