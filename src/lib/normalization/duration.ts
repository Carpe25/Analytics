export interface DaySlice {
  date: string;              // YYYY-MM-DD in local timezone
  durationMinutes: number;
  hours: number;
  startTimeUtc: string;
  endTimeUtc: string;
  partIndex: number;
  totalParts: number;
}

/**
 * Returns the exact Unix millisecond timestamp when the local clock in `timezone` struck 00:00:00 on `dateStr` (YYYY-MM-DD).
 */
export function getLocalMidnightMs(dateStr: string, timezone: string = "Asia/Kolkata"): number {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  let target = Date.UTC(y, m - 1, d, 0, 0, 0, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  for (let i = 0; i < 3; i++) {
    const formattedParts = formatter.formatToParts(new Date(target));
    const p: Record<string, string> = {};
    for (const part of formattedParts) p[part.type] = part.value;
    const curDate = `${p.year}-${p.month}-${p.day}`;
    const h = parseInt(p.hour, 10);
    const min = parseInt(p.minute, 10);
    const sec = parseInt(p.second, 10);

    const diffMs = (h * 3600 + min * 60 + sec) * 1000;
    if (curDate === dateStr && diffMs === 0) break;
    if (curDate > dateStr) {
      target -= 24 * 3600 * 1000 + diffMs;
    } else if (curDate < dateStr) {
      target += 24 * 3600 * 1000 - diffMs;
    } else {
      target -= diffMs;
    }
  }
  return target;
}

export function getNextDateStr(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}

/**
 * Splits a continuous work duration between `startMs` and `endMs` across midnight boundaries
 * according to the specified timezone.
 *
 * Example: 10:00 PM to 04:00 AM (6 hours) produces:
 * - Slice 1: Day 1 (120 mins / 2.0h)
 * - Slice 2: Day 2 (240 mins / 4.0h)
 */
export function splitDurationAcrossMidnight(
  startMs: number,
  endMs: number,
  timezone: string = "Asia/Kolkata"
): DaySlice[] {
  if (endMs <= startMs) {
    const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(startMs));
    return [
      {
        date: dStr,
        durationMinutes: 1,
        hours: 0.02,
        startTimeUtc: new Date(startMs).toISOString(),
        endTimeUtc: new Date(endMs).toISOString(),
        partIndex: 1,
        totalParts: 1,
      },
    ];
  }

  const getLocalDate = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(ms));

  const startDateStr = getLocalDate(startMs);
  const endDateStr = getLocalDate(endMs);

  // If both fall on the same local date, no midnight split is required
  if (startDateStr === endDateStr) {
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    return [
      {
        date: startDateStr,
        durationMinutes,
        hours: Math.round((durationMinutes / 60) * 100) / 100,
        startTimeUtc: new Date(startMs).toISOString(),
        endTimeUtc: new Date(endMs).toISOString(),
        partIndex: 1,
        totalParts: 1,
      },
    ];
  }

  // Crosses one or more midnights: split segment by segment preserving total duration
  const totalIntervalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
  const slices: Omit<DaySlice, "partIndex" | "totalParts">[] = [];
  let curStartMs = startMs;
  let allocatedMinutes = 0;

  while (curStartMs < endMs) {
    const curDateStr = getLocalDate(curStartMs);
    const nextDayDateStr = getNextDateStr(curDateStr);
    const nextMidnightMs = getLocalMidnightMs(nextDayDateStr, timezone);

    // Safeguard to prevent infinite loops if nextMidnightMs <= curStartMs
    const segmentEndMs = nextMidnightMs > curStartMs ? Math.min(endMs, nextMidnightMs) : endMs;
    const isLastSlice = segmentEndMs >= endMs;

    let durationMinutes: number;
    if (isLastSlice) {
      durationMinutes = Math.max(1, totalIntervalMinutes - allocatedMinutes);
    } else {
      const sliceFraction = (segmentEndMs - curStartMs) / (endMs - startMs);
      durationMinutes = Math.max(1, Math.round(totalIntervalMinutes * sliceFraction));
      allocatedMinutes += durationMinutes;
    }

    slices.push({
      date: curDateStr,
      durationMinutes,
      hours: Math.round((durationMinutes / 60) * 100) / 100,
      startTimeUtc: new Date(curStartMs).toISOString(),
      endTimeUtc: new Date(segmentEndMs).toISOString(),
    });

    curStartMs = segmentEndMs;
  }

  const totalParts = slices.length;
  return slices.map((s, idx) => ({
    ...s,
    partIndex: idx + 1,
    totalParts,
  }));
}

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
