import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isLinodeConfigured, getLinodeS3Client } from "@/lib/storage/linode-s3";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const parts = resolvedParams.path || [];
    let relPath = parts.join("/");

    // Handle encoded slashes if key was passed as single encoded parameter
    if (relPath.includes("%2F") || relPath.includes("%2f")) {
      relPath = decodeURIComponent(relPath);
    }

    // Try MinIO / S3 first if configured
    if (isLinodeConfigured()) {
      try {
        const client = getLinodeS3Client();
        const bucket = process.env.LINODE_STORAGE_BUCKET!;
        const s3Key = relPath.startsWith("tickets/photos/")
          ? relPath
          : relPath.includes("tickets/photos/")
          ? relPath.substring(relPath.indexOf("tickets/photos/"))
          : `tickets/photos/${relPath}`;

        const res = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          })
        );

        if (res.Body) {
          const bytes = Buffer.from(await res.Body.transformToByteArray());
          const contentType = res.ContentType || "image/webp";
          return new NextResponse(bytes, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
          });
        }
      } catch (s3Err) {
        console.warn("Could not fetch photo from S3/MinIO, trying local fallback:", s3Err);
      }
    }

    // Local disk fallback
    const safeRelPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.resolve(process.cwd(), ".artifacts", safeRelPath);

    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
}
