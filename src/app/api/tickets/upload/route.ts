import { NextRequest, NextResponse } from "next/server";
import { uploadTicketPhotoDirect } from "@/lib/storage/linode-s3";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "screenshot.png";
    const contentType = file.type || "image/png";

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
