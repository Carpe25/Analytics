import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Strict regex validation to prevent path traversal
    if (!/^tickets\/photos\/[a-zA-Z0-9._-]+$/i.test(key) || key.includes("..")) {
      return NextResponse.json(
        { error: "Invalid photo key format. Path traversal is not permitted." },
        { status: 400 }
      );
    }

    const ext = path.extname(key).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only images (.jpg, .jpeg, .png, .webp, .gif) are allowed." },
        { status: 400 }
      );
    }

    // Guard against oversized uploads before reading the body
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds maximum size of 10MB" }, { status: 413 });
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty file body provided" }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds maximum size of 10MB" }, { status: 413 });
    }

    const basePhotosDir = path.resolve(process.cwd(), ".artifacts", "tickets", "photos");
    const filePath = path.resolve(process.cwd(), ".artifacts", key);

    // Ensure filePath remains inside basePhotosDir
    const relativeToPhotos = path.relative(basePhotosDir, filePath);
    if (relativeToPhotos.startsWith("..") || path.isAbsolute(relativeToPhotos)) {
      return NextResponse.json({ error: "Path traversal detected" }, { status: 403 });
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
