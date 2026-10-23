import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { checkConfigurationStatus } from "../src/lib/config/env";

describe("Architecture & Security Rules Verification", () => {
  it("verifies NO database libraries or ORMs are installed in package.json", async () => {
    const pkgRaw = await fs.readFile(path.resolve(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw);

    const forbidden = [
      "prisma",
      "@prisma/client",
      "drizzle-orm",
      "pg",
      "mysql",
      "mysql2",
      "sqlite3",
      "better-sqlite3",
      "mongodb",
      "mongoose",
      "typeorm",
      "sequelize",
    ];

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const forbiddenLib of forbidden) {
      expect(allDeps[forbiddenLib]).toBeUndefined();
    }
  });

  it("ensures checkConfigurationStatus never leaks raw private keys or tokens", () => {
    process.env.GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----";
    process.env.GITHUB_TOKEN = "ghp_super_secret_github_token_value_12345";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sync-service@company.iam.gserviceaccount.com";

    const status = checkConfigurationStatus();

    // Verify boolean/redacted status
    expect(status.github.tokenPresent).toBe(true);
    // Secret itself must not be anywhere in the return object
    const statusJson = JSON.stringify(status);
    expect(statusJson).not.toContain("ghp_super_secret_github_token_value_12345");
    expect(statusJson).not.toContain("BEGIN PRIVATE KEY");
  });
});
