import { IArtifactStorage } from "./interface";
import { LocalArtifactStorage } from "./local-adapter";
import { S3ArtifactStorage } from "./s3-adapter";
import { getAppEnv } from "@/lib/config/env";

let storageInstance: IArtifactStorage | null = null;

export function getArtifactStorage(): IArtifactStorage {
  if (storageInstance) {
    return storageInstance;
  }

  const env = getAppEnv();
  if (env.artifactStorageProvider === "s3" && env.artifactStorageBucket && env.artifactStorageAccessKey && env.artifactStorageSecretKey) {
    storageInstance = new S3ArtifactStorage({
      bucket: env.artifactStorageBucket,
      region: env.artifactStorageRegion,
      endpoint: env.artifactStorageEndpoint,
      accessKeyId: env.artifactStorageAccessKey,
      secretAccessKey: env.artifactStorageSecretKey,
    });
  } else {
    storageInstance = new LocalArtifactStorage(env.artifactStorageLocalDir);
  }

  return storageInstance;
}
