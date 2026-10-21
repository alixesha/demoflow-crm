
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  ErrorBox,
  Loading,
  OutcomePill,
  PageHeader,
  StatusPill,
  Pill,
} from "@/components/crm/ui-bits";
import type { AppointmentStatus, DemoOutcome } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/appointments/")({
  head: () => ({
    meta: [{ title: "Appointments — DemoDesk CRM" }],
  }),
  component: Appointments,
});

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  local_date: string;
  local_time: string;
  timezone: string;
  status: AppointmentStatus;
  outcome: DemoOutcome | null;
  platform: "zoom" | "google_meet";
  duration_minutes: number;
  is_demo: boolean;
  clients: {
    business_name: string;
    owner_name: string;
    phone: string;
    country: string;
  } | null;
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, local_date, local_time, timezone, status, outcome, platform, duration_minutes, is_demo, clients(business_name, owner_name, phone, country)",
        )
        .order("scheduled_at", { ascending: false })
        .limit(500);

      if (queryError) throw queryError;

      setAppointments((data ?? []) as unknown as AppointmentRow[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Appointments could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    return appointments.filter((appointment) => {
      const client = appointment.clients;
      const matchesSearch =
        !term ||
        client?.business_name?.toLowerCase().includes(term) ||
        client?.owner_name?.toLowerCase().includes(term) ||
        client?.phone?.toLowerCase().includes(term) ||
        appointment.id.toLowerCase().includes(term);

      const matchesStatus =
        status === "all" || appointment.status === status;

      const scheduledTime = new Date(appointment.scheduled_at).getTime();

      const matchesDate =
        dateRange === "all" ||
        (dateRange === "upcoming" &&
          scheduledTime >= now &&
          ["scheduled", "rescheduled"].includes(appointment.status)) ||
        (dateRange === "past" && scheduledTime < now) ||
        (dateRange === "today" &&
          appointment.local_date ===
            new Intl.DateTimeFormat("en-CA", {
              timeZone: appointment.timezone || "UTC",
            }).format(new Date()));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [appointments, search, status, dateRange]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Manage bookings, track demo progress and find client appointments."
        actions={
          <>
            <button
              onClick={() => void loadAppointments()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <Link
              to="/appointments/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New Appointment
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface p-4">
          <p className="text-sm text-muted-foreground">Loaded appointments</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {loading ? "—" : appointments.length}
          </p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-muted-foreground">Matching results</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {loading ? "—" : filteredAppointments.length}
          </p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-muted-foreground">Demo records</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {loading
              ? "—"
              : appointments.filter((appointment) => appointment.is_demo)
                  .length}
          </p>
        </div>
      </div>

      <section className="surface space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Search and filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, contact or phone..."
              aria-label="Search appointments"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            aria-label="Filter by date"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All dates</option>
            <option value="today">Today (client timezone)</option>
            <option value="upcoming">Upcoming demos</option>
            <option value="past">Past appointments</option>
          </select>
        </div>

        {(search || status !== "all" || dateRange !== "all") && (
          <button
            onClick={() => {
              setSearch("");
              setStatus("all");
              setDateRange("all");
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </section>

      {error && <ErrorBox error={error} />}

      {loading ? (
        <div className="surface">
          <Loading label="Loading appointments..." />
        </div>
      ) : !error && filteredAppointments.length === 0 ? (
        <div className="surface px-6 py-14 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            {appointments.length === 0
              ? "No appointments yet"
              : "No matching appointments"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {appointments.length === 0
              ? "Create your first appointment to start organizing website demos."
              : "Try changing your search or filters to see more results."}
          </p>
          {appointments.length === 0 && (
            <Link
              to="/appointments/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Create appointment
            </Link>
          )}
        </div>
      ) : (
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Appointment records
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing matching records from the latest 500 loaded.
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {filteredAppointments.length} results
            </span>
          </div>

          <div className="divide-y divide-border">
            {filteredAppointments.map((appointment) => (
              <article
                key={appointment.id}
                className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/20 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="mt-1 rounded-xl bg-primary/10 p-3">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {appointment.clients?.business_name ||
                          "Unnamed client"}
                      </h3>
                      {appointment.is_demo && (
                        <Pill tone="muted">Demo record</Pill>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {appointment.clients?.owner_name || "No contact name"}
                      {appointment.clients?.phone
                        ? ` · ${appointment.clients.phone}`
                        : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {appointment.local_date} at {appointment.local_time}
                      </span>
                      <span>
                        {appointment.duration_minutes} min
                      </span>
                      <span>
                        {appointment.platform === "google_meet"
                          ? "Google Meet"
                          : "Zoom"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusPill status={appointment.status} />
                  <OutcomePill outcome={appointment.outcome} />

                  <Link
                    to="/appointments/$id"
                    params={{ id: appointment.id }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    View details
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
        }
                
