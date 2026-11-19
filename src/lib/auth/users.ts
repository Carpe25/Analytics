import crypto from "crypto";
import { AuthUser, UserRole } from "@/types";

export interface StoredUser {
  username: string;
  passwordHash: string; // PBKDF2 hash: pbkdf2$iterations$salt$hash
  name: string;
  role: UserRole;
  developerId?: string;
}

// Cryptographically hashed default team members using PBKDF2 (SHA-512 with 100,000 iterations & unique salts)
const DEFAULT_USERS: StoredUser[] = [
  {
    username: "manager",
    passwordHash: "pbkdf2$100000$87f33261d71e0b613c97044462c76447$807df8765f9e2fbbd607140dfc3f5112e464191a5ec2e919faa2db95f70e3666c0aca7328c2817cd980e8b36b7e65fed209846857ebb71484ac911d342af7a52",
    name: "Lead Manager",
    role: "manager",
  },
  {
    username: "admin",
    passwordHash: "pbkdf2$100000$4591e59633acf7bacbde850c49d24705$3675e90701df8c69d58c25734ae6acc8e1a740d5f427d710bb31dc9e8dcbd7b6681004465d2e4570bd6d3890e72ed9b4d026d2cb955cab70505113af123d6228",
    name: "Administrator",
    role: "manager",
  },
  {
    username: "jay",
    passwordHash: "pbkdf2$100000$ee46c6d7a7d3eba64d7e880e9ed580f8$af65704f62355a8ce7e29aa9da6d7413e889133c13ffb08aff49509877bf34168bf0d9471d7686831dd6626d4b4357c59ea946e6b6fbac412f93e587d0937665",
    name: "Jay",
    role: "developer",
    developerId: "dev-jay",
  },
  {
    username: "kaif",
    passwordHash: "pbkdf2$100000$43f0ec54e63d6d02aa4b65dec5660db2$8fdd9affd468d84016dc71a1dcc31b1c1c273403f318001aff6c404a74fe57ff4b4f6a1d9a0a7fdbad505d6eaf0576ed76af0f3198497f45a238b2c2f81a859e",
    name: "Kaif",
    role: "developer",
    developerId: "dev-kaif",
  },
  {
    username: "mahesh",
    passwordHash: "pbkdf2$100000$00e014eaaf6dd2d6a35fc13bb797848d$8b11ca64f6e971d02a5f60ab26fcf2bad8f8df9bca656e0a599b1a076bb257f881603c83f0b9e3151174a4ded6ad0c83c8dbc86bac5b06a0127a8da807959c69",
    name: "Mahesh",
    role: "developer",
    developerId: "dev-mahesh",
  },
  {
    username: "amol",
    passwordHash: "pbkdf2$100000$5bc885a7eb56b7cc9e346737028fe570$e344986b6982667251c4b0b6109a70e75b95c2fc1dd78e25d6bf4431319b8202222b6dbf8092d0288d36ddd59808189aa0ae388a14beb9a49ab4c901d93ee028",
    name: "Amol",
    role: "developer",
    developerId: "dev-amol",
  },
];

export function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString("hex")): string {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `pbkdf2$100000$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  try {
    if (stored.startsWith("pbkdf2$")) {
      const parts = stored.split("$");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHash = parts[3];
      const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
      return crypto.timingSafeEqual(Buffer.from(verifyHash, "hex"), Buffer.from(expectedHash, "hex"));
    }
    // Backward compatibility for legacy plaintext (prevents timing attacks)
    const bufA = Buffer.from(password);
    const bufB = Buffer.from(stored);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function getUsers(): StoredUser[] {
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
  const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

  if (!user) return null;
  if (!verifyPassword(cleanPassword, user.passwordHash)) return null;

  return {
    username: user.username,
    name: user.name,
    role: user.role,
    developerId: user.developerId,
  };
}

export {
  AUTH_COOKIE_NAME,
  getSessionSecret,
  createSignedSessionToken,
  verifySignedSessionTokenAsync,
} from "./session";


