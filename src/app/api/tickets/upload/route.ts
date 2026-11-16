import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { uploadTicketPhotoDirect } from "@/lib/storage/linode-s3";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 413 });
    }

    const contentType = (file.type || "").toLowerCase();
    const fileName = file.name || "screenshot.png";
    const ext = path.extname(fileName).toLowerCase();

    // Reject non-raster images (prevent SVG XSS)
    if (!ALLOWED_MIME_TYPES.has(contentType) || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only raster images (.jpg, .jpeg, .png, .webp, .gif) are permitted." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadTicketPhotoDirect(buffer, fileName, contentType);

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      key: result.key,
    });
  } catch (err: any) {
    console.error("Direct photo upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}
