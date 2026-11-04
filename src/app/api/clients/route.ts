import { NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { Client } from "@/types";

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
    const id = `client-${slug || Date.now()}`;

    const newClient: Client = {
      id,
      name,
      code: code || undefined,
      description: description || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveClient(newClient);

    return NextResponse.json({
      success: true,
      client: newClient,
    });
  } catch (err: any) {
    console.error("Failed to create client:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create client" },
      { status: 500 }
    );
  }
}
