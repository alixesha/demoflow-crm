import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function listTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch {
    /* ignore */
  }
  return ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Karachi", "Asia/Dubai", "Australia/Sydney"];
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Convert a wall-clock date ("2026-03-08") + time ("09:30") in an IANA zone to a UTC Date. */
export function localToUtc(date: string, time: string, tz: string): Date {
  const t = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${t}`, tz);
}

export function formatInZone(iso: string | Date, tz: string, fmt = "EEE, MMM d yyyy · h:mm a"): string {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, fmt);
}

export function zoneAbbr(iso: string | Date, tz: string): string {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, "zzz");
}
