import { describe, expect, it } from "vitest";
import { formatInZone, localToUtc } from "./tz";

describe("time zone conversion", () => {
  it("converts New York 09:00 in winter (EST, UTC-5) to 14:00 UTC", () => {
    expect(localToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });
  it("converts New York 09:00 in summer (EDT, UTC-4) to 13:00 UTC", () => {
    expect(localToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
  it("converts Karachi 18:30 (UTC+5) to 13:30 UTC", () => {
    expect(localToUtc("2026-10-21", "18:30", "Asia/Karachi").toISOString()).toBe("2026-10-21T13:30:00.000Z");
  });
  it("displays a UTC instant in the client's zone", () => {
    expect(formatInZone("2026-01-15T14:00:00Z", "America/New_York", "yyyy-MM-dd HH:mm")).toBe("2026-01-15 09:00");
    expect(formatInZone("2026-01-15T14:00:00Z", "Asia/Karachi", "yyyy-MM-dd HH:mm")).toBe("2026-01-15 19:00");
  });
});
