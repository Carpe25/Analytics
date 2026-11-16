import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSignedSessionToken,
  verifySignedSessionTokenAsync,
  AUTH_COOKIE_NAME,
} from "../src/lib/auth/users";
import {
  getRequestAuth,
  canAccessDeveloper,
  verifyDeveloperAccessOrForbidden,
  isManager,
} from "../src/lib/auth/guard";
import { AuthUser } from "../src/types";

describe("Security & Horizontal Authorization Isolation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-high-entropy-session-secret-key-64-bytes-super-secure!!";
    process.env.TRACKER_API_KEY = "test-tracker-api-key-32-chars-long";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Cryptographic Token Security", () => {
    it("generates a signed 3-part HMAC token and verifies successfully", async () => {
      const devUser: AuthUser = {
        username: "jay",
        name: "Jay",
        role: "developer",
        developerId: "dev-jay",
      };

      const token = await createSignedSessionToken(devUser);
      expect(token.split(".")).toHaveLength(3);

      const verified = await verifySignedSessionTokenAsync(token);
      expect(verified).not.toBeNull();
      expect(verified?.username).toBe("jay");
      expect(verified?.role).toBe("developer");
      expect(verified?.developerId).toBe("dev-jay");
    });

    it("REJECTS forged unsigned base64 tokens (anti-spoofing)", async () => {
      // Attacker creates a fake token payload trying to claim admin role
      const fakePayload = JSON.stringify({
        sub: "admin",
        role: "manager",
        name: "Administrator",
      });
      const forgedToken = Buffer.from(fakePayload).toString("base64url");

      const verified = await verifySignedSessionTokenAsync(forgedToken);
      expect(verified).toBeNull();
    });

    it("REJECTS tampered tokens where payload was altered after signing", async () => {
      const devUser: AuthUser = {
        username: "jay",
        name: "Jay",
        role: "developer",
        developerId: "dev-jay",
      };

      const token = await createSignedSessionToken(devUser);
      const [header, , signature] = token.split(".");

      // Attacker tampers payload to escalate role to manager
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: "jay",
          name: "Jay",
          role: "manager",
        })
      ).toString("base64url");

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
      const verified = await verifySignedSessionTokenAsync(tamperedToken);
      expect(verified).toBeNull();
    });
  });

  describe("Developer Account Isolation (Anti-IDOR / Anti-BOLA)", () => {
    const devJayContext = {
      user: {
        username: "jay",
        name: "Jay",
        role: "developer" as const,
        developerId: "dev-jay",
      },
      isApiKey: false,
      isCron: false,
      isAuthenticated: true,
    };

    const managerContext = {
      user: {
        username: "manager",
        name: "Lead Manager",
        role: "manager" as const,
      },
      isApiKey: false,
      isCron: false,
      isAuthenticated: true,
    };

    it("allows developer Jay to access his own records", () => {
      expect(canAccessDeveloper(devJayContext, "dev-jay")).toBe(true);
      expect(canAccessDeveloper(devJayContext, "jay")).toBe(true);
      expect(canAccessDeveloper(devJayContext, "Jay Patel")).toBe(true);

      const forbidden = verifyDeveloperAccessOrForbidden(devJayContext, "dev-jay");
      expect(forbidden).toBeNull();
    });

    it("STRICTLY BLOCKS developer Jay from accessing Kaif, Amol, or Mahesh records", () => {
      expect(canAccessDeveloper(devJayContext, "dev-kaif")).toBe(false);
      expect(canAccessDeveloper(devJayContext, "kaif")).toBe(false);
      expect(canAccessDeveloper(devJayContext, "dev-amol")).toBe(false);
      expect(canAccessDeveloper(devJayContext, "dev-mahesh")).toBe(false);

      const forbidden = verifyDeveloperAccessOrForbidden(devJayContext, "dev-kaif");
      expect(forbidden).not.toBeNull();
      expect(forbidden?.status).toBe(403);
    });

    it("allows managers to access any developer records", () => {
      expect(isManager(managerContext)).toBe(true);
      expect(canAccessDeveloper(managerContext, "dev-jay")).toBe(true);
      expect(canAccessDeveloper(managerContext, "dev-kaif")).toBe(true);
      expect(canAccessDeveloper(managerContext, "dev-amol")).toBe(true);

      const forbidden = verifyDeveloperAccessOrForbidden(managerContext, "dev-kaif");
      expect(forbidden).toBeNull();
    });

    it("rejects unauthenticated requests", () => {
      const unauthContext = {
        user: null,
        isApiKey: false,
        isCron: false,
        isAuthenticated: false,
      };

      expect(canAccessDeveloper(unauthContext, "dev-jay")).toBe(false);
      const forbidden = verifyDeveloperAccessOrForbidden(unauthContext, "dev-jay");
      expect(forbidden?.status).toBe(403);
    });
  });

  describe("API Authentication via getRequestAuth", () => {
    it("authenticates valid signed cookie", async () => {
      const user: AuthUser = {
        username: "kaif",
        name: "Kaif",
        role: "developer",
        developerId: "dev-kaif",
      };
      const token = await createSignedSessionToken(user);

      const req = new NextRequest("http://localhost:3000/api/work-logs", {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });

      const auth = await getRequestAuth(req);
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.user?.username).toBe("kaif");
      expect(auth.isApiKey).toBe(false);
    });

    it("authenticates valid TRACKER_API_KEY", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-logs", {
        headers: {
          authorization: `Bearer ${process.env.TRACKER_API_KEY}`,
        },
      });

      const auth = await getRequestAuth(req);
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.isApiKey).toBe(true);
    });

    it("rejects requests when no credentials or invalid API keys are provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/work-logs", {
        headers: {
          authorization: "Bearer wrong-key",
        },
      });

      const auth = await getRequestAuth(req);
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.user).toBeNull();
    });
  });
});
