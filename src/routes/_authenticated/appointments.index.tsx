
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Search,
  RefreshCw,
  Eye,
  CalendarDays,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/labels";
import {
  PageHeader,
  Loading,
  ErrorBox,
  EmptyState,
  StatusPill,
  OutcomePill,
} from "@/components/crm/ui-bits";

type AppointmentRow = {
  id: string;
  client_id: string;
  booking_agent_id: string;
  demo_staff_id: string | null;
  local_date: string;
  local_time: string;
  timezone: string;
  platform: "zoom" | "google_meet";
  meeting_url: string | null;
  status: AppointmentStatus;
  outcome:
    | "interested"
    | "follow_up_required"
    | "not_interested"
    | "sold"
    | "lost"
    | null;
  sale_amount: number | null;
  follow_up_date: string | null;
  is_demo: boolean;
  clients: {
    business_name: string;
    owner_name: string;
    phone: string;
    country: string;
  } | null;
};

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Los_Angeles": "Pacific Time",
  "America/Chicago": "Central Time",
  "America/New_York": "Eastern Time",
};

export const Route = createFileRoute("/_authenticated/appointments/")({
  head: () => ({
    meta: [{ title: "Appointments — DemoDesk CRM" }],
  }),
  component: Appointments,
});

function Appointments() {
  const { userId, hasRole } = useAuth();

  const isAdmin = hasRole("admin");
  const isDemoStaff = hasRole("demo_staff");

  const canCreateAppointment =
    isAdmin || hasRole("booking_agent");

  // Meeting links are hidden from Admin and Demo Staff on this page.
  const canSeeMeetingLink = !isAdmin && !isDemoStaff;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const {
    data: appointments = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "appointments-list",
      userId,
      isAdmin,
      isDemoStaff,
      hasRole("booking_agent"),
    ],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(`
          id,
          client_id,
          booking_agent_id,
          demo_staff_id,
          local_date,
          local_time,
          timezone,
          platform,
          meeting_url,
          status,
          outcome,
          sale_amount,
          follow_up_date,
          is_demo,
          clients (
            business_name,
            owner_name,
            phone,
            country
          )
        `)
        .order("scheduled_at", { ascending: false })
        .limit(500);

      // Booking agents only load their own appointments.
      // Supabase RLS must enforce this restriction as well.
      if (!isAdmin && !isDemoStaff && userId) {
        query = query.eq("booking_agent_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const filteredAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const client = appointment.clients;

      const matchesSearch =
        !term ||
        client?.business_name?.toLowerCase().includes(term) ||
        client?.owner_name?.toLowerCase().includes(term) ||
        client?.phone?.toLowerCase().includes(term) ||
        appointment.id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || appointment.status === statusFilter;

      let today: string;

      try {
        today = new Intl.DateTimeFormat("en-CA", {
          timeZone: appointment.timezone || "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch {
        today = new Date().toISOString().slice(0, 10);
      }

      const isUpcomingStatus = [
        "scheduled",
        "rescheduled",
      ].includes(appointment.status);

      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "today" &&
          appointment.local_date === today) ||
        (dateFilter === "upcoming" &&
          appointment.local_date >= today &&
          isUpcomingStatus) ||
        (dateFilter === "past" &&
          appointment.local_date < today);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [appointments, search, statusFilter, dateFilter]);

  if (isLoading) {
    return <Loading label="Loading appointments..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="View and manage website demo bookings."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isFetching ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            {canCreateAppointment && (
              <Link
                to="/appointments/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <CalendarPlus className="h-4 w-4" />
                New Appointment
              </Link>
            )}
          </div>
        }
      />

      {error && <ErrorBox error={error.message} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            Total Loaded
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {appointments.length}
          </p>
        </div>

        <div className="surface rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            Scheduled
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              appointments.filter((appointment) =>
                ["scheduled", "rescheduled"].includes(
                  appointment.status,
                ),
              ).length
            }
          </p>
        </div>

        <div className="surface rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            Completed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              appointments.filter(
                (appointment) =>
                  appointment.status === "completed",
              ).length
            }
          </p>
        </div>
      </div>

      <div className="surface space-y-4 rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, phone or appointment ID..."
              aria-label="Search appointments"
              className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border bg-background px-3 py-2.5 text-sm"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            aria-label="Filter by date"
            className="rounded-lg border bg-background px-3 py-2.5 text-sm"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming Scheduled</option>
            <option value="past">Past Dates</option>
          </select>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredAppointments.length} of{" "}
          {appointments.length} loaded appointments.
        </p>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="surface rounded-xl">
          <EmptyState
            icon={CalendarDays}
            title="No appointments found"
            text={
              appointments.length === 0
                ? "No appointments are available for your account yet."
                : "Try changing your search or filters."
            }
            action={
              canCreateAppointment ? (
                <Link
                  to="/appointments/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Book an Appointment
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appointment) => {
            const client = appointment.clients;

            const timezoneLabel =
              TIMEZONE_LABELS[appointment.timezone] ||
              appointment.timezone ||
              "Timezone not set";

            return (
              <div
                key={appointment.id}
                className="surface flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">
                      {client?.business_name || "Unknown Client"}
                    </h2>
                    <StatusPill status={appointment.status} />
                    <OutcomePill outcome={appointment.outcome} />
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {client?.owner_name || "No Contact Name"}
                    {client?.phone ? ` · ${client.phone}` : ""}
                    {client?.country ? ` · ${client.country}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">
                        Date:
                      </span>{" "}
                      {appointment.local_date}
                    </span>

                    <span>
                      <span className="font-medium text-foreground">
                        Time:
                      </span>{" "}
                      {appointment.local_time}
                    </span>

                    <span>
                      <span className="font-medium text-foreground">
                        Timezone:
                      </span>{" "}
                      {timezoneLabel}
                    </span>

                    <span>
                      {appointment.platform === "google_meet"
                        ? "Google Meet"
                        : "Zoom"}
                    </span>

                    {appointment.follow_up_date && (
                      <span>
                        Follow-up: {appointment.follow_up_date}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/appointments/$id"
                    params={{ id: appointment.id }}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>

                  {canSeeMeetingLink && appointment.meeting_url && (
                    <a
                      href={appointment.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
                                  }
                    
