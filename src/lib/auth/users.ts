import { AuthUser, UserRole } from "@/types";

export interface StoredUser {
  username: string;
  passwordHash: string; // Plaintext or simple hash for local simplicity
  name: string;
  role: UserRole;
  developerId?: string;
}

// Default team members
const DEFAULT_USERS: StoredUser[] = [
  {
    username: "manager",
    passwordHash: "manager123",
    name: "Lead Manager",
    role: "manager",
  },
  {
    username: "admin",
    passwordHash: "admin123",
    name: "Administrator",
    role: "manager",
  },
  {
    username: "jay",
    passwordHash: "jay123",
    name: "Jay",
    role: "developer",
    developerId: "dev-jay",
  },
  {
    username: "kaif",
    passwordHash: "kaif123",
    name: "Kaif",
    role: "developer",
    developerId: "dev-kaif",
  },
  {
    username: "mahesh",
    passwordHash: "mahesh123",
    name: "Mahesh",
    role: "developer",
    developerId: "dev-mahesh",
  },
  {
    username: "amol",
    passwordHash: "amol123",
    name: "Amol",
    role: "developer",
    developerId: "dev-amol",
  },
];

export function getUsers(): StoredUser[] {
  // Allow overriding via environment variable JSON if provided
  if (process.env.TEAM_USERS_CONFIG) {
    try {
      const custom = JSON.parse(process.env.TEAM_USERS_CONFIG);
      if (Array.isArray(custom) && custom.length > 0) {
        return custom;
      }
    } catch {}
  }
  return DEFAULT_USERS;
}

export function verifyCredentials(username: string, password: string): AuthUser | null {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.passwordHash === cleanPassword
  );

  if (!user) return null;

  return {
    username: user.username,
    name: user.name,
    role: user.role,
    developerId: user.developerId,
  };
}

export const AUTH_COOKIE_NAME = "analytics_team_auth";

// Lightweight cookie session encode/decode
export function encodeUserSession(user: AuthUser): string {
  const payload = JSON.stringify(user);
  return Buffer.from(payload).toString("base64url");
}

export function decodeUserSession(token: string): AuthUser | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const user = JSON.parse(raw);
    if (user?.username && user?.role) {
      return user as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}
