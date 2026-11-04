import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  isLinode: boolean;
}

export function isLinodeConfigured(): boolean {
  return Boolean(
    process.env.LINODE_STORAGE_ENDPOINT &&
    process.env.LINODE_STORAGE_BUCKET &&
    process.env.LINODE_STORAGE_ACCESS_KEY &&
    process.env.LINODE_STORAGE_SECRET_KEY
  );
}

export function getLinodeS3Client(): S3Client {
  const endpoint = (process.env.LINODE_STORAGE_ENDPOINT || "").trim().replace(/\/+$/, "");
  const region = (process.env.LINODE_STORAGE_REGION || "us-east-1").trim();
  const accessKeyId = (process.env.LINODE_STORAGE_ACCESS_KEY || "").trim();
  const secretAccessKey = (process.env.LINODE_STORAGE_SECRET_KEY || "").trim();

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

/**
 * Generates an S3 presigned PUT URL for uploading ticket photos directly to Linode Object Storage.
 * If Linode credentials are not configured, returns a local API fallback upload URL.
 */
export async function createTicketPhotoUploadUrl(
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<PresignedUrlResult> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `tickets/photos/${timestamp}-${randomSuffix}-${sanitizedName}`;

  if (!isLinodeConfigured()) {
    // Local fallback: use /api/tickets/upload-local
    return {
      uploadUrl: `/api/tickets/upload-local?key=${encodeURIComponent(key)}`,
      fileUrl: `/api/tickets/photos/${encodeURIComponent(key)}`,
      key,
      isLinode: false,
    };
  }

  const client = getLinodeS3Client();
  const bucket = process.env.LINODE_STORAGE_BUCKET!;
  const endpoint = process.env.LINODE_STORAGE_ENDPOINT!;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // URL valid for 15 minutes (900 seconds)
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

  // Public access URL
  let fileUrl: string;
  if (process.env.LINODE_STORAGE_PUBLIC_BASE_URL) {
    const base = process.env.LINODE_STORAGE_PUBLIC_BASE_URL.replace(/\/$/, "");
    fileUrl = `${base}/${key}`;
  } else {
    const cleanEndpoint = endpoint.replace(/\/$/, "");
    fileUrl = `${cleanEndpoint}/${bucket}/${key}`;
  }

  return {
    uploadUrl,
    fileUrl,
    key,
    isLinode: true,
  };
}

/**
 * Direct server-side upload to MinIO/Linode or local disk.
 * Completely eliminates browser CORS issues because the upload happens server-to-server!
 */
export async function uploadTicketPhotoDirect(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<{ fileUrl: string; key: string }> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `tickets/photos/${timestamp}-${randomSuffix}-${sanitizedName}`;

  if (!isLinodeConfigured()) {
    const fs = await import("fs/promises");
    const path = await import("path");
    const localPath = path.resolve(process.cwd(), ".artifacts", key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    return {
      fileUrl: `/api/tickets/photos/${encodeURIComponent(key)}`,
      key,
    };
  }

  const client = getLinodeS3Client();
  const bucket = process.env.LINODE_STORAGE_BUCKET!;
  const endpoint = process.env.LINODE_STORAGE_ENDPOINT!;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  let fileUrl: string;
  if (process.env.LINODE_STORAGE_PUBLIC_BASE_URL) {
    const base = process.env.LINODE_STORAGE_PUBLIC_BASE_URL.replace(/\/$/, "");
    fileUrl = `${base}/${key}`;
  } else {
    const cleanEndpoint = endpoint.replace(/\/$/, "");
    fileUrl = `${cleanEndpoint}/${bucket}/${key}`;
  }

  return { fileUrl, key };
}
