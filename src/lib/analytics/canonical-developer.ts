/**
 * Canonical Developer definitions and alias resolution.
 * Merges GitHub handles, full names, tab names, and legacy IDs into unified developer profiles.
 */

export interface CanonicalDeveloperInfo {
  id: string;
  name: string;
  aliases: string[];
}

export const KNOWN_CANONICAL_DEVELOPERS: Record<string, CanonicalDeveloperInfo> = {
  "dev-jay": {
    id: "dev-jay",
    name: "Jay",
    aliases: ["jay", "jaytcdj-dev", "jaydev", "jay-eng", "jay patel", "jaypatel"],
  },
  "dev-kaif": {
    id: "dev-kaif",
    name: "Kaif",
    aliases: ["kaif", "khankaif", "kaif khan", "kaif-khan", "khan kaif"],
  },
  "dev-mahesh": {
    id: "dev-mahesh",
    name: "Mahesh",
    aliases: ["mahesh", "maheshthakur9152", "mahesh thakur", "mahesh-thakur", "maheshthakur"],
  },
  "dev-amol": {
    id: "dev-amol",
    name: "Amol",
    aliases: ["amol", "amol yadav", "amolyadav", "amol-yadav"],
  },
  "dev-jemish": {
    id: "dev-jemish",
    name: "Jemish Sakariya",
    aliases: ["jemish", "jemish sakariya", "jemish-sakariya", "jemish-vision", "jemishvision"],
  },
  "dev-ashfaq-hussain": {
    id: "dev-ashfaq-hussain",
    name: "Ashfaq Hussain",
    aliases: ["ashfaq", "ashfaq hussain", "ashfaq-hussain"],
  },
  "dev-paulkumar-nadar": {
    id: "dev-paulkumar-nadar",
    name: "Paulkumar Nadar",
    aliases: ["paulkumar", "paulkumar nadar", "paulkumar-nadar"],
  },
  "dev-zaid-khan": {
    id: "dev-zaid-khan",
    name: "Zaid Khan",
    aliases: ["zaid", "zaid khan", "zaid-khan"],
  },
  "dev-vikas-rathod": {
    id: "dev-vikas-rathod",
    name: "Vikas Rathod",
    aliases: ["vikas", "vikas rathod", "vikas-rathod"],
  },
};

function formatDefaultName(str: string): string {
  if (!str) return "Developer";
  return str
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Resolves any developer ID, name, or GitHub username to a canonical developer identity.
 */
export function resolveCanonicalDeveloper(
  rawIdentifier: string | undefined | null,
  customMapping?: Record<string, string[]>
): { id: string; name: string } {
  if (!rawIdentifier) {
    return { id: "dev-unknown", name: "Unknown" };
  }

  const raw = String(rawIdentifier).trim();
  const lower = raw.toLowerCase();
  const stripped = lower.replace(/^dev-/, "");
  const normalizedNoPunct = stripped.replace(/[^a-z0-9]/g, "");

  // 1. Check custom settings developerGithubMapping first
  if (customMapping) {
    for (const [devId, handles] of Object.entries(customMapping)) {
      const devIdLower = devId.toLowerCase();
      const devIdStripped = devIdLower.replace(/^dev-/, "");
      if (
        lower === devIdLower ||
        stripped === devIdStripped ||
        (devIdStripped && normalizedNoPunct === devIdStripped.replace(/[^a-z0-9]/g, ""))
      ) {
        return {
          id: devId,
          name: KNOWN_CANONICAL_DEVELOPERS[devId]?.name || formatDefaultName(devIdStripped),
        };
      }
      for (const h of handles) {
        const hLower = h.toLowerCase().trim();
        const hStripped = hLower.replace(/^dev-/, "");
        if (
          lower === hLower ||
          stripped === hStripped ||
          (hStripped && normalizedNoPunct === hStripped.replace(/[^a-z0-9]/g, ""))
        ) {
          return {
            id: devId,
            name: KNOWN_CANONICAL_DEVELOPERS[devId]?.name || formatDefaultName(devIdStripped),
          };
        }
      }
    }
  }

  // 2. Check built-in known canonical developers
  for (const [canonId, info] of Object.entries(KNOWN_CANONICAL_DEVELOPERS)) {
    const canonStripped = canonId.replace(/^dev-/, "");
    if (
      lower === canonId ||
      stripped === canonStripped ||
      normalizedNoPunct === canonStripped.replace(/[^a-z0-9]/g, "")
    ) {
      return { id: info.id, name: info.name };
    }
    for (const alias of info.aliases) {
      const aLower = alias.toLowerCase().trim();
      const aStripped = aLower.replace(/^dev-/, "");
      if (
        lower === aLower ||
        stripped === aStripped ||
        normalizedNoPunct === aStripped.replace(/[^a-z0-9]/g, "")
      ) {
        return { id: info.id, name: info.name };
      }
    }
  }

  // 3. Fallback: standard developer ID and name
  const fallbackId = `dev-${stripped.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return {
    id: fallbackId,
    name: formatDefaultName(stripped),
  };
}
