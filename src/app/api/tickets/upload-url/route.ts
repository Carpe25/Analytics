import { NextRequest, NextResponse } from "next/server";
import { createTicketPhotoUploadUrl } from "@/lib/storage/linode-s3";

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    const result = await createTicketPhotoUploadUrl(fileName, fileType || "image/jpeg");
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate upload URL" }, { status: 500 });
  }
}
