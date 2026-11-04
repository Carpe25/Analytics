import { NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getUnifiedClientDirectory } from "@/lib/projects/client-breakdown";

export async function GET() {
  try {
    const storage = getArtifactStorage();
    const directory = await getUnifiedClientDirectory(storage);

    return NextResponse.json(directory);
  } catch (err: any) {
    console.error("Failed to load public directory:", err);
    return NextResponse.json({ error: err.message || "Failed to load directory" }, { status: 500 });
  }
}
