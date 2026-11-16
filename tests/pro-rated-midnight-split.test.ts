import { describe, it, expect } from "vitest";
import { splitDurationAcrossMidnight, getLocalMidnightMs } from "@/lib/normalization/duration";

describe("splitDurationAcrossMidnight", () => {
  const tz = "Asia/Kolkata";

  it("keeps same-day work within a single slice", () => {
    // 2:00 PM to 4:30 PM on 2026-11-16 (2.5 hours = 150 minutes)
    const start = new Date("2026-11-16T14:00:00+05:30").getTime();
    const end = new Date("2026-11-16T16:30:00+05:30").getTime();

    const slices = splitDurationAcrossMidnight(start, end, tz);
    expect(slices).toHaveLength(1);
    expect(slices[0].date).toBe("2026-11-16");
    expect(slices[0].durationMinutes).toBe(150);
    expect(slices[0].hours).toBe(2.5);
    expect(slices[0].partIndex).toBe(1);
    expect(slices[0].totalParts).toBe(1);
  });

  it("correctly splits 10:00 PM to 4:00 AM night shift into exact 2h and 4h slices", () => {
    // 10:00 PM (Nov 16) to 4:00 AM (Nov 17) in Asia/Kolkata
    // Total = 6 hours = 360 minutes
    const start = new Date("2026-11-16T22:00:00+05:30").getTime();
    const end = new Date("2026-11-17T04:00:00+05:30").getTime();

    const slices = splitDurationAcrossMidnight(start, end, tz);
    expect(slices).toHaveLength(2);

    // Slice 1: 10:00 PM to 12:00 AM (Midnight) = 120 minutes = 2.0 hours
    expect(slices[0].date).toBe("2026-11-16");
    expect(slices[0].durationMinutes).toBe(120);
    expect(slices[0].hours).toBe(2.0);
    expect(slices[0].partIndex).toBe(1);
    expect(slices[0].totalParts).toBe(2);

    // Slice 2: 12:00 AM to 4:00 AM = 240 minutes = 4.0 hours
    expect(slices[1].date).toBe("2026-11-17");
    expect(slices[1].durationMinutes).toBe(240);
    expect(slices[1].hours).toBe(4.0);
    expect(slices[1].partIndex).toBe(2);
    expect(slices[1].totalParts).toBe(2);
  });

  it("handles narrow midnight boundary crossing (11:45 PM to 12:15 AM)", () => {
    const start = new Date("2026-11-16T23:45:00+05:30").getTime();
    const end = new Date("2026-11-17T00:15:00+05:30").getTime();

    const slices = splitDurationAcrossMidnight(start, end, tz);
    expect(slices).toHaveLength(2);
    expect(slices[0].date).toBe("2026-11-16");
    expect(slices[0].durationMinutes).toBe(15);
    expect(slices[1].date).toBe("2026-11-17");
    expect(slices[1].durationMinutes).toBe(15);
  });
});
