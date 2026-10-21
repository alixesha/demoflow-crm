
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
} from "@/components/crm/ui-bits";
import type { AppointmentStatus } from "@/lib/labels";

type CalendarAppointment = {
  id: string;
  local_date: string;
  local_time: string;
  timezone: string;
  duration_minutes: number;
  meeting_url: string;
  platform: "zoom" | "google_meet";
  status: AppointmentStatus;
  clients: {
    business_name: string;
    owner_name: string;
    phone: string;
  } | null;
};

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — DemoDesk CRM" }] }),
  component: Calendar,
});

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Calendar() {
  const { loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [view, setView] = useState<"day" | "week" | "all">("week");

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("appointments")
      .select(
        "id, local_date, local_time, timezone, duration_minutes, meeting_url, platform, status, clients(business_name, owner_name, phone)",
      )
      .order("local_date", { ascending: true })
      .order("local_time", { ascending: true })
      .limit(500);

    if (fetchError) {
      setError(fetchError.message);
      setAppointments([]);
    } else {
      setAppointments((data ?? []) as unknown as CalendarAppointment[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const visibleAppointments = useMemo(() => {
    if (view === "all") return appointments;

    const selected = new Date(`${selectedDate}T12:00:00`);
    const start = new Date(selected);
    const end = new Date(selected);

    if (view === "week") {
      const day = (selected.getDay() + 6) % 7;
      start.setDate(selected.getDate() - day);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
    }

    const startKey = dateKey(start);
    const endKey = dateKey(end);

    return appointments.filter(
      (appointment) =>
        appointment.local_date >= startKey &&
        appointment.local_date <= endKey,
    );
  }, [appointments, selectedDate, view]);

  const groupedAppointments = useMemo(() => {
    const groups: Record<string, CalendarAppointment[]> = {};

    for (const appointment of visibleAppointments) {
      if (!groups[appointment.local_date]) {
        groups[appointment.local_date] = [];
      }
      groups[appointment.local_date].push(appointment);
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleAppointments]);

  const scheduledCount = visibleAppointments.filter(
    (appointment) =>
      appointment.status === "scheduled" ||
      appointment.status === "rescheduled",
  ).length;

  if (authLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Calendar"
        subtitle="View upcoming demos and meeting schedules."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadAppointments()}
              disabled={loading}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Refresh
            </button>
            <Link
              to="/appointments/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + Book Appointment
            </Link>
          </div>
        }
      />

      {error && <ErrorBox message={error} />}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Appointments Shown" value={visibleAppointments.length} />
        <StatCard label="Scheduled / Rescheduled" value={scheduledCount} />
        <StatCard
          label="Completed"
          value={
            visibleAppointments.filter((a) => a.status === "completed").length
          }
        />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <label htmlFor="calendar-date" className="text-sm font-medium">
              Select Date
            </label>
            <input
              id="calendar-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="block rounded-lg border bg-background px-3 py-2.5"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ViewButton active={view === "day"} onClick={() => setView("day")}>
              Day
            </ViewButton>
            <ViewButton active={view === "week"} onClick={() => setView("week")}>
              Week
            </ViewButton>
            <ViewButton active={view === "all"} onClick={() => setView("all")}>
              All Loaded
            </ViewButton>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : groupedAppointments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="font-semibold">No appointments in this view</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose another date or book a new appointment.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedAppointments.map(([date, items]) => (
              <section key={date} className="space-y-3">
                <div className="border-b pb-2">
                  <h2 className="font-semibold">{formatDate(date)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {items.length} appointment{items.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="space-y-3">
                  {items.map((appointment) => (
                    <article
                      key={appointment.id}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">
                            {formatTime(appointment.local_time)} ·{" "}
                            {appointment.duration_minutes} min
                          </p>
                          <h3 className="font-semibold">
                            {appointment.clients?.business_name ??
                              "Client information unavailable"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {appointment.clients?.owner_name ?? "—"}
                            {appointment.clients?.phone
                              ? ` · ${appointment.clients.phone}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.timezone} ·{" "}
                            {appointment.platform === "zoom"
                              ? "Zoom"
                              : "Google Meet"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={appointment.status} />
                          <Link
                            to="/appointments/$id"
                            params={{ id: appointment.id }}
                            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                          >
                            View Details
                          </Link>
                          <a
                            href={appointment.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                          >
                            Join Meeting
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Calendar loads up to 500 appointments permitted by your account's
          database access policies.
        </p>
      </section>
    </div>
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
  }
              
