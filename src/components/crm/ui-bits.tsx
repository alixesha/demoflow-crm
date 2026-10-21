import type { ReactNode } from "react";
import { Loader2, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OUTCOME_LABEL, OUTCOME_TONE, STATUS_LABEL, STATUS_TONE, type AppRole, type AppointmentStatus, type DemoOutcome } from "@/lib/labels";
import { useAuth } from "@/lib/auth";

const toneCls = {
  info: "bg-info/12 text-info ring-info/25",
  warning: "bg-warning/18 text-warning-foreground ring-warning/35",
  success: "bg-success/12 text-success ring-success/25",
  muted: "bg-muted text-muted-foreground ring-border",
  destructive: "bg-destructive/10 text-destructive ring-destructive/25",
};

export function Pill({ tone, children }: { tone: keyof typeof toneCls; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", toneCls[tone])}>
      {children}
    </span>
  );
}

export const StatusPill = ({ status }: { status: AppointmentStatus }) => <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
export const OutcomePill = ({ outcome }: { outcome: DemoOutcome | null }) =>
  outcome ? <Pill tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Pill> : <span className="text-xs text-muted-foreground">—</span>;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-secondary p-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {error instanceof Error ? error.message : "Could not load data."}
    </div>
  );
}

export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { roles: mine } = useAuth();
  if (!roles.some((r) => mine.includes(r)))
    return <EmptyState icon={ShieldAlert} title="You don't have access to this page" text="Ask an admin if you need this permission." />;
  return <>{children}</>;
}

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
