
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
} from "@/components/crm/ui-bits";

type Appointment = {
  id: string;
  booking_agent_id: string;
  local_date: string;
  status: "scheduled" | "rescheduled" | "completed" | "cancelled" | "no_show";
  outcome: string | null;
  sale_amount: number | null;
  is_demo: boolean;
  clients: {
    business_name: string;
    owner_name: string;
  } | null;
};

type Period = "all" | "month" | "30days";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [{ title: "Reports — DemoDesk CRM" }],
  }),
  component: Reports,
});

function Reports() {
  const { userId, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isDemoStaff = hasRole("demo_staff");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("month");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("appointments")
      .select(
        "id, booking_agent_id, local_date, status, outcome, sale_amount, is_demo, clients(business_name, owner_name)"
      )
      .order("local_date", { ascending: false })
      .limit(2000);

    // Agents should only see their own appointments.
    // Supabase RLS must enforce permissions independently.
    if (!isAdmin && !isDemoStaff && userId) {
      query = query.eq("booking_agent_id", userId);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setAppointments([]);
    } else {
      setAppointments((data ?? []) as unknown as Appointment[]);
    }

    setLoading(false);
  }, [isAdmin, isDemoStaff, userId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filtered = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA");

    return appointments.filter((appointment) => {
      if (period === "all") return true;

      if (period === "month") {
        return appointment.local_date.slice(0, 7) === today.slice(0, 7);
      }

      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 29);
      const cutoffDate = [
        cutoff.getFullYear(),
        String(cutoff.getMonth() + 1).padStart(2, "0"),
        String(cutoff.getDate()).padStart(2, "0"),
      ].join("-");

      return (
        appointment.local_date >= cutoffDate &&
        appointment.local_date <= today
      );
    });
  }, [appointments, period]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((a) => a.status === "completed").length;
    const cancelled = filtered.filter((a) => a.status === "cancelled").length;
    const noShow = filtered.filter((a) => a.status === "no_show").length;
    const scheduled = filtered.filter(
      (a) => a.status === "scheduled" || a.status === "rescheduled"
    ).length;

    const sold = filtered.filter(
      (a) => a.outcome === "sold" && a.sale_amount !== null
    );

    const sales = sold.reduce((sum, a) => sum + (a.sale_amount ?? 0), 0);

    const conversionRate =
      completed > 0
        ? (filtered.filter((a) => a.outcome === "sold").length / completed) * 100
        : 0;

    return {
      total,
      completed,
      cancelled,
      noShow,
      scheduled,
      sales,
      soldCount: filtered.filter((a) => a.outcome === "sold").length,
      conversionRate,
    };
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; total: number; completed: number; sold: number }[] = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        total: 0,
        completed: 0,
        sold: 0,
      });
    }

    for (const appointment of appointments) {
      const month = months.find((m) => m.key === appointment.local_date.slice(0, 7));
      if (!month) continue;
      month.total++;
      if (appointment.status === "completed") month.completed++;
      if (appointment.outcome === "sold") month.sold++;
    }

    return months;
  }, [appointments]);

  const maxMonthly = Math.max(1, ...monthlyData.map((m) => m.total));

  const outcomes = [
    { label: "Interested", key: "interested", color: "bg-blue-500" },
    { label: "Follow-up required", key: "follow_up_required", color: "bg-amber-500" },
    { label: "Sold", key: "sold", color: "bg-emerald-500" },
    { label: "Not interested", key: "not_interested", color: "bg-rose-500" },
    { label: "Lost", key: "lost", color: "bg-slate-500" },
  ].map((outcome) => ({
    ...outcome,
    count: filtered.filter((a) => a.outcome === outcome.key).length,
  }));

  const outcomeTotal = outcomes.reduce((sum, outcome) => sum + outcome.count, 0);

  const currency = (amount: number) =>
    new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Track demo activity, sales outcomes and business performance."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <PeriodButton active={period === "month"} onClick={() => setPeriod("month")}>
            This month
          </PeriodButton>
          <PeriodButton active={period === "30days"} onClick={() => setPeriod("30days")}>
            Last 30 days
          </PeriodButton>
          <PeriodButton active={period === "all"} onClick={() => setPeriod("all")}>
            All loaded data
          </PeriodButton>
        </div>

        <button
          type="button"
          onClick={() => void loadReports()}
          className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Refresh reports
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Total appointments" value={stats.total} detail="In selected period" />
            <MetricCard label="Completed demos" value={stats.completed} detail="Marked completed" />
            <MetricCard label="Scheduled / rescheduled" value={stats.scheduled} detail="Still on the schedule" />
            <MetricCard label="Sales closed" value={stats.soldCount} detail="Outcome marked sold" />
            <MetricCard label="Sales amount" value={currency(stats.sales)} detail="Sum of recorded sale amounts" />
            <MetricCard label="Conversion rate" value={`${stats.conversionRate.toFixed(1)}%`} detail="Sold outcomes ÷ completed demos" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">Appointment status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Breakdown for the selected period
              </p>

              <div className="mt-5 space-y-4">
                <BreakdownRow label="Scheduled / rescheduled" value={stats.scheduled} total={stats.total} />
                <BreakdownRow label="Completed" value={stats.completed} total={stats.total} />
                <BreakdownRow label="Cancelled" value={stats.cancelled} total={stats.total} />
                <BreakdownRow label="No-show" value={stats.noShow} total={stats.total} />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">Demo outcomes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recorded results from demos
              </p>

              <div className="mt-5 space-y-4">
                {outcomes.map((outcome) => {
                  const percent =
                    outcomeTotal > 0 ? (outcome.count / outcomeTotal) * 100 : 0;

                  return (
                    <div key={outcome.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span>{outcome.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {outcome.count} · {percent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${outcome.color}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {outcomeTotal === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No outcomes have been recorded for this period yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Monthly performance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Appointments, completed demos and sales for the last six calendar months
            </p>

            <div className="mt-6 space-y-5">
              {monthlyData.map((month) => (
                <div key={month.key} className="grid grid-cols-[4rem_1fr_5rem] items-center gap-3">
                  <span className="text-sm text-muted-foreground">{month.label}</span>
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(month.total / maxMonthly) * 100}%` }}
                      />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(month.completed / maxMonthly) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{month.total} demos</div>
                    <div>{month.sold} sold</div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Total appointments
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Completed demos
                </span>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <h2 className="font-semibold">Recent appointments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest appointments in the selected period
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No appointments found for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Business</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Outcome</th>
                      <th className="px-5 py-3 text-right font-medium">Sale amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 25).map((appointment) => (
                      <tr key={appointment.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-5 py-3">{appointment.local_date}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium">
                            {appointment.clients?.business_name || "Unknown business"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {appointment.clients?.owner_name || ""}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill status={appointment.status} />
                        </td>
                        <td className="px-5 py-3 capitalize">
                          {appointment.outcome?.replaceAll("_", " ") || "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {appointment.sale_amount === null ? "—" : currency(appointment.sale_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Report data is limited to the latest 2,000 appointments returned by the database.
            Sales totals include only appointments with an outcome marked as sold and a recorded amount.
          </p>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function PeriodButton({
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
      className={`min-h-9 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
                           }
                              
