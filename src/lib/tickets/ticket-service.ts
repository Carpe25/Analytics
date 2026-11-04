import fs from "fs/promises";
import path from "path";
import { Ticket, TicketStatus } from "@/types";

const TICKETS_FILE = path.resolve(process.cwd(), ".artifacts", "tickets", "tickets.json");

async function ensureTicketsDir(): Promise<void> {
  const dir = path.dirname(TICKETS_FILE);
  await fs.mkdir(dir, { recursive: true });
}

export async function readTickets(): Promise<Ticket[]> {
  try {
    await ensureTicketsDir();
    const data = await fs.readFile(TICKETS_FILE, "utf8");
    return JSON.parse(data) as Ticket[];
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return [];
    }
    console.error("Error reading tickets:", err);
    return [];
  }
}

export async function writeTickets(tickets: Ticket[]): Promise<void> {
  await ensureTicketsDir();
  const tempPath = `${TICKETS_FILE}.tmp.${Date.now()}`;
  await fs.writeFile(tempPath, JSON.stringify(tickets, null, 2), "utf8");
  await fs.rename(tempPath, TICKETS_FILE);
}

export async function getNextTicketNumber(): Promise<string> {
  const tickets = await readTickets();
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
  const tickets = await readTickets();
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

  tickets.unshift(newTicket);
  await writeTickets(tickets);
  return newTicket;
}

export async function makeTicketLive(ticketId: string, reviewerName: string = "Manager"): Promise<Ticket | null> {
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
