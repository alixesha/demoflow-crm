import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type DemoOutcome = Database["public"]["Enums"]["demo_outcome"];
export type Platform = Database["public"]["Enums"]["meeting_platform"];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  booking_agent: "Booking Agent",
  demo_staff: "Demo Staff",
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const OUTCOME_LABEL: Record<DemoOutcome, string> = {
  interested: "Interested",
  follow_up_required: "Follow-up Required",
  not_interested: "Not Interested",
  sold: "Sold",
  lost: "Lost",
};

export const PLATFORM_LABEL: Record<Platform, string> = { zoom: "Zoom", google_meet: "Google Meet" };

export const STATUS_TONE: Record<AppointmentStatus, "info" | "warning" | "success" | "muted" | "destructive"> = {
  scheduled: "info",
  rescheduled: "warning",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
};

export const OUTCOME_TONE: Record<DemoOutcome, "info" | "warning" | "success" | "muted" | "destructive"> = {
  interested: "info",
  follow_up_required: "warning",
  not_interested: "muted",
  sold: "success",
  lost: "destructive",
};

export function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));
}
