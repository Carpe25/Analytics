export interface ParsedDurationResult {
  minutes: number;
  hours: number;
  raw: string;
  isValid: boolean;
  error?: string;
}

/**
 * Parses duration from raw spreadsheet input.
 * Supports:
 * - Decimal numbers: 1.5 -> 90 minutes
 * - H:MM format: 1:30 -> 90 minutes, 0:45 -> 45 minutes
 * - Time strings: "1h 30m", "2h", "45m", "1 hr 15 min"
 * Rejects negative values, non-durations, and implausible durations (> 24 hours).
 */
export function parseDurationToMinutes(val: unknown): ParsedDurationResult {
  if (val === null || val === undefined || val === "") {
    return { minutes: 0, hours: 0, raw: "", isValid: false, error: "Duration value is empty" };
  }

  const raw = String(val).trim();

  // If already a number
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Invalid numeric duration" };
    }
    if (val < 0) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration cannot be negative" };
    }
    if (val > 24) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: `Implausible single log duration (${val}h > 24h)` };
    }
    const minutes = Math.round(val * 60);
    return { minutes, hours: minutes / 60, raw, isValid: true };
  }

  // Format: "1:30" or "01:45" or "1:30:00"
  if (/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.test(raw)) {
    const parts = raw.split(":").map(Number);
    const h = parts[0];
    const m = parts[1];
    if (h < 0 || m < 0) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration cannot be negative" };
    }
    const totalMinutes = h * 60 + m;
    if (totalMinutes > 24 * 60) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration exceeds 24 hours" };
    }
    return { minutes: totalMinutes, hours: totalMinutes / 60, raw, isValid: true };
  }

  // Format: decimal string e.g. "1.5", "2", "0.75"
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const num = parseFloat(raw);
    if (num < 0) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration cannot be negative" };
    }
    if (num > 24) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration exceeds 24 hours" };
    }
    const minutes = Math.round(num * 60);
    return { minutes, hours: minutes / 60, raw, isValid: true };
  }

  // Format: "1h 30m", "1 hr 30 mins", "45m", "2h", "1.5h"
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)/i);
  const minMatch = raw.match(/(\d+)\s*(?:m|min|mins|minutes?)/i);

  if (hourMatch || minMatch) {
    let totalMinutes = 0;
    if (hourMatch) {
      const h = parseFloat(hourMatch[1]);
      if (h < 0) return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration cannot be negative" };
      totalMinutes += Math.round(h * 60);
    }
    if (minMatch) {
      const m = parseInt(minMatch[1], 10);
      if (m < 0) return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration cannot be negative" };
      totalMinutes += m;
    }

    if (totalMinutes > 24 * 60) {
      return { minutes: 0, hours: 0, raw, isValid: false, error: "Duration exceeds 24 hours" };
    }

    return { minutes: totalMinutes, hours: totalMinutes / 60, raw, isValid: true };
  }

  return {
    minutes: 0,
    hours: 0,
    raw,
    isValid: false,
    error: `Unrecognized duration format: "${raw}"`,
  };
}
