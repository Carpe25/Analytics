import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { Client } from "@/types";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const storage = getArtifactStorage();
    const clients = await storage.readClients();
    return NextResponse.json({ clients });
  } catch (err: any) {
    console.error("Failed to fetch clients:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load clients" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only Managers or authorized API key can create clients
  if (!isManager(auth)) {
    return NextResponse.json(
      { error: "Forbidden: Only Managers can create new clients." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const code = (body.code || "").trim().toUpperCase();
    const description = (body.description || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const storage = getArtifactStorage();
    const existingClients = await storage.readClients();

    const normalizedName = name.toLowerCase();
    const duplicate = existingClients.find(
      (c) => c.name.toLowerCase() === normalizedName
    );

    if (duplicate) {
      return NextResponse.json(
        { error: `Client "${duplicate.name}" already exists` },
        { status: 409 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const newClient: Client = {
      id: `client-${slug}-${Date.now().toString(36)}`,
      name,
      code: code || undefined,
      description: description || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveClient(newClient);

    return NextResponse.json(
      { success: true, client: newClient },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Failed to create client:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create client" },
      { status: 500 }
    );
  }
}
