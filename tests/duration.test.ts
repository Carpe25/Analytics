import { describe, it, expect } from "vitest";
import { parseDurationToMinutes } from "../src/lib/normalization/duration";

describe("Duration Parser", () => {
  it("parses decimal hours correctly", () => {
    expect(parseDurationToMinutes(1.5)).toEqual({
      minutes: 90,
      hours: 1.5,
      raw: "1.5",
      isValid: true,
    });
    expect(parseDurationToMinutes("2.25")).toEqual({
      minutes: 135,
      hours: 2.25,
      raw: "2.25",
      isValid: true,
    });
  });

  it("parses H:MM format correctly", () => {
    expect(parseDurationToMinutes("1:30")).toEqual({
      minutes: 90,
      hours: 1.5,
      raw: "1:30",
      isValid: true,
    });
    expect(parseDurationToMinutes("0:45")).toEqual({
      minutes: 45,
      hours: 0.75,
      raw: "0:45",
      isValid: true,
    });
    expect(parseDurationToMinutes("02:15")).toEqual({
      minutes: 135,
      hours: 2.25,
      raw: "02:15",
      isValid: true,
    });
  });

  it("parses text duration strings", () => {
    expect(parseDurationToMinutes("1h 30m")).toEqual({
      minutes: 90,
      hours: 1.5,
      raw: "1h 30m",
      isValid: true,
    });
    expect(parseDurationToMinutes("45m")).toEqual({
      minutes: 45,
      hours: 0.75,
      raw: "45m",
      isValid: true,
    });
    expect(parseDurationToMinutes("2 hours")).toEqual({
      minutes: 120,
      hours: 2,
      raw: "2 hours",
      isValid: true,
    });
  });

  it("rejects negative durations", () => {
    const res1 = parseDurationToMinutes(-1.5);
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("negative");

    const res2 = parseDurationToMinutes("-2");
    expect(res2.isValid).toBe(false);
  });

  it("rejects implausible durations (> 24h)", () => {
    const res = parseDurationToMinutes(25);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("24h");
  });

  it("handles empty or invalid strings gracefully without silent conversion to 0", () => {
    const resEmpty = parseDurationToMinutes("");
    expect(resEmpty.isValid).toBe(false);

    const resGarbage = parseDurationToMinutes("hello-world");
    expect(resGarbage.isValid).toBe(false);
    expect(resGarbage.error).toContain("Unrecognized");
  });
});
