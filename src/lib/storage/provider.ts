import { IArtifactStorage } from "./interface";
import { LocalArtifactStorage } from "./local-adapter";
import { S3ArtifactStorage } from "./s3-adapter";
import { NeonArtifactStorage } from "./neon-adapter";
import { getAppEnv } from "@/lib/config/env";

const globalForStorage = globalThis as unknown as {
  artifactStorageInstance?: IArtifactStorage;
};

export function getArtifactStorage(): IArtifactStorage {
  if (globalForStorage.artifactStorageInstance) {
    return globalForStorage.artifactStorageInstance;
  }

  const env = getAppEnv();
  let instance: IArtifactStorage;

  if (env.artifactStorageProvider === "neon" && (env.databaseUrl || process.env.DATABASE_URL)) {
    instance = new NeonArtifactStorage(env.databaseUrl || process.env.DATABASE_URL);
  } else if (env.artifactStorageProvider === "s3" && env.artifactStorageBucket && env.artifactStorageAccessKey && env.artifactStorageSecretKey) {
    instance = new S3ArtifactStorage({
      bucket: env.artifactStorageBucket,
      region: env.artifactStorageRegion,
      endpoint: env.artifactStorageEndpoint,
      accessKeyId: env.artifactStorageAccessKey,
      secretAccessKey: env.artifactStorageSecretKey,
    });
  } else {
    instance = new LocalArtifactStorage(env.artifactStorageLocalDir);
  }

  globalForStorage.artifactStorageInstance = instance;
  return instance;
}
