export interface AppEnv {
  appBaseUrl: string;
  appTimezone: string;
  googleAuthMode: "service_account" | "api_key";
  googleServiceAccountEmail: string;
  googlePrivateKey: string;
  githubAuthMode: "token" | "github_app";
  githubToken: string;
  githubAppId?: string;
  githubAppPrivateKey?: string;
  githubInstallationId?: string;
  artifactStorageProvider: "neon" | "local" | "s3";
  databaseUrl?: string;
  artifactStorageLocalDir: string;
  artifactStorageBucket?: string;
  artifactStorageRegion: string;
  artifactStorageEndpoint?: string;
  artifactStorageAccessKey?: string;
  artifactStorageSecretKey?: string;
  cronSecret: string;
  manualSyncSecret?: string;
  enableDailySnapshots: boolean;
  githubInitialImportDays: number;
  githubMaxCommitsPerRepository: number;
}

export function getAppEnv(): AppEnv {
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").trim();
  // Strip outer quotes if present
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }
  // Decode literal \n characters
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  // Ensure valid PEM header and footer if key payload was provided without them
  if (privateKey && !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
  }

  const dbUrl = process.env.DATABASE_URL;
  let provider: "neon" | "local" | "s3" = "local";
  if (process.env.ARTIFACT_STORAGE_PROVIDER === "neon" || (dbUrl && process.env.ARTIFACT_STORAGE_PROVIDER !== "local" && process.env.ARTIFACT_STORAGE_PROVIDER !== "s3")) {
    provider = "neon";
  } else if (process.env.ARTIFACT_STORAGE_PROVIDER === "s3") {
    provider = "s3";
  }

  return {
    appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    appTimezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
    googleAuthMode: (process.env.GOOGLE_AUTH_MODE as any) === "api_key" ? "api_key" : "service_account",
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    googlePrivateKey: privateKey,
    githubAuthMode: (process.env.GITHUB_AUTH_MODE as any) === "github_app" ? "github_app" : "token",
    githubToken: process.env.GITHUB_TOKEN || "",
    githubAppId: process.env.GITHUB_APP_ID,
    githubAppPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    githubInstallationId: process.env.GITHUB_INSTALLATION_ID,
    artifactStorageProvider: provider,
    databaseUrl: dbUrl,
    artifactStorageLocalDir: process.env.ARTIFACT_STORAGE_LOCAL_DIR || ".artifacts",
    artifactStorageBucket: process.env.ARTIFACT_STORAGE_BUCKET,
    artifactStorageRegion: process.env.ARTIFACT_STORAGE_REGION || "us-east-1",
    artifactStorageEndpoint: process.env.ARTIFACT_STORAGE_ENDPOINT,
    artifactStorageAccessKey: process.env.ARTIFACT_STORAGE_ACCESS_KEY,
    artifactStorageSecretKey: process.env.ARTIFACT_STORAGE_SECRET_KEY,
    cronSecret: process.env.CRON_SECRET || "",
    manualSyncSecret: process.env.MANUAL_SYNC_SECRET,
    enableDailySnapshots: process.env.ENABLE_DAILY_SNAPSHOTS === "true",
    githubInitialImportDays: parseInt(process.env.GITHUB_INITIAL_IMPORT_DAYS || "90", 10),
    githubMaxCommitsPerRepository: parseInt(process.env.GITHUB_MAX_COMMITS_PER_REPOSITORY || "500", 10),
  };
}

export function checkConfigurationStatus() {
  const env = getAppEnv();
  const googleConfigured = Boolean(
    (env.googleAuthMode === "service_account" && env.googleServiceAccountEmail && env.googlePrivateKey) ||
    Boolean(process.env.GOOGLE_API_KEY)
  );

  const githubConfigured = Boolean(
    (env.githubAuthMode === "token" && env.githubToken) ||
    (env.githubAuthMode === "github_app" && env.githubAppId && env.githubAppPrivateKey && env.githubInstallationId)
  );

  const storageConfigured =
    (env.artifactStorageProvider === "neon" && Boolean(env.databaseUrl)) ||
    env.artifactStorageProvider === "local" ||
    (env.artifactStorageProvider === "s3" &&
      Boolean(env.artifactStorageBucket && env.artifactStorageAccessKey && env.artifactStorageSecretKey));

  return {
    appTimezone: env.appTimezone,
    google: {
      configured: googleConfigured,
      mode: env.googleAuthMode,
      serviceAccount: env.googleServiceAccountEmail ? `${env.googleServiceAccountEmail.slice(0, 4)}...${env.googleServiceAccountEmail.slice(-15)}` : null,
    },
    github: {
      configured: githubConfigured,
      mode: env.githubAuthMode,
      tokenPresent: Boolean(env.githubToken),
    },
    storage: {
      configured: storageConfigured,
      provider: env.artifactStorageProvider,
      isLocal: env.artifactStorageProvider === "local",
      bucket: env.artifactStorageBucket || null,
    },
    cron: {
      configured: Boolean(env.cronSecret),
    },
  };
}
