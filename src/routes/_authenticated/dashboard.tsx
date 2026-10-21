import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  OUTCOME_LABEL,
  STATUS_LABEL,
  type AppointmentStatus,
  type DemoOutcome,
} from "@/lib/labels";
import {
  ErrorBox,
  Loading,
  OutcomePill,
  PageHeader,
  Stat,
  StatusPill,
} from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — DemoDesk CRM" }],
  }),
  component: Dashboard,
});

type RecentAppointment = {
  id: string;
  created_at: string;
  scheduled_at: string;
  local_date: string;
  local_time: string;
  status: AppointmentStatus;
  outcome: DemoOutcome | null;
  clients: {
    business_name: string;
    owner_name: string;
  } | null;
};

function Dashboard() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [sales, setSales] = useState(0);
  const [recent, setRecent] = useState<RecentAppointment[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const today = new Date().toISOString().slice(0, 10);

      const [
        totalResult,
        upcomingResult,
        followUpResult,
        salesResult,
        recentResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", false),

        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", false)
          .in("status", ["scheduled", "rescheduled"])
          .gte("scheduled_at", now),

        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", false)
          .eq("outcome", "follow_up_required")
          .not("follow_up_date", "is", null)
          .lte("follow_up_date", today),

        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", false)
          .eq("outcome", "sold"),

        supabase
          .from("appointments")
          .select(
            "id, created_at, scheduled_at, local_date, local_time, status, outcome, clients(business_name, owner_name)",
          )
          .eq("is_demo", false)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const firstError =
        totalResult.error ||
        upcomingResult.error ||
        followUpResult.error ||
        salesResult.error ||
        recentResult.error;

      if (firstError) throw firstError;

      setTotal(totalResult.count ?? 0);
      setUpcoming(upcomingResult.count ?? 0);
      setFollowUps(followUpResult.count ?? 0);
      setSales(salesResult.count ?? 0);
      setRecent((recentResult.data ?? []) as RecentAppointment[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Your website demo operations at a glance."
        actions={
          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        }
      />

      <section className="surface flex flex-col justify-between gap-4 overflow-hidden p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Welcome back
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {profile?.full_name || "Team Member"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep your bookings organized and your demos moving forward.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">DemoDesk CRM</p>
            <p className="text-xs text-muted-foreground">
              Live workspace
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="space-y-3">
          <ErrorBox error={error} />
          <button
            onClick={() => void loadDashboard()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try loading again
          </button>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Performance overview
          </h2>
          <span className="text-xs text-muted-foreground">
            Excludes demo records
          </span>
        </div>

        {loading ? (
          <Loading label="Loading your dashboard..." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Total Appointments"
              value={total.toLocaleString()}
              hint="All non-demo appointments"
              icon={CalendarDays}
            />
            <Stat
              label="Upcoming Demos"
              value={upcoming.toLocaleString()}
              hint="Scheduled or rescheduled"
              icon={Clock3}
            />
            <Stat
              label="Follow-ups Due"
              value={followUps.toLocaleString()}
              hint="Required follow-ups due today or earlier"
              icon={AlertCircle}
            />
            <Stat
              label="Sales Closed"
              value={sales.toLocaleString()}
              hint="Appointments marked as sold"
              icon={TrendingUp}
            />
          </div>
        )}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Recent Appointments
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest bookings recorded in your workspace.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Live database
          </div>
        </div>

        {loading ? (
          <Loading label="Loading recent appointments..." />
        ) : recent.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <h3 className="mt-3 font-semibold">No appointments yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your latest bookings will appear here when they are added.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-col gap-3 p-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {appointment.clients?.business_name ||
                        "Unnamed client"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {appointment.clients?.owner_name || "No contact name"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {appointment.local_date} · {appointment.local_time}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusPill status={appointment.status} />
                  <OutcomePill outcome={appointment.outcome} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Showing the 6 most recently created appointments.
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Appointment access follows your account's database permissions.
      </p>
    </div>
  );
        }
            
