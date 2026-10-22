import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Bell, CalendarCheck2, CalendarDays, CalendarPlus, LayoutDashboard, ListChecks, LogOut, Settings, Users, UserCog, BarChart3, Building2, Loader2, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type AppRole } from "@/lib/labels";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const NAV: { title: string; url: string; icon: typeof Users; roles?: AppRole[] }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Appointments", url: "/appointments", icon: ListChecks },
  { title: "New Appointment", url: "/appointments/new", icon: CalendarPlus, roles: ["admin", "booking_agent"] },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Follow-ups", url: "/follow-ups", icon: Clock, roles: ["admin", "demo_staff"] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin"] },
  { title: "Staff", url: "/staff", icon: UserCog, roles: ["admin"] },
  { title: "Settings", url: "/settings", icon: Settings },
];

function Shell() {
  const { loading, roles, profile, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (roles.length === 0)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="surface max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">{profile && !profile.is_active ? "Account deactivated" : "Awaiting access"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {session?.user.email}. An admin needs to assign you a role before you can use the CRM.
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );

  const items = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
  const isActive = (u: string) => (u === "/appointments" ? path === u || (/^\/appointments\/(?!new)/.test(path)) : path === u || path.startsWith(u + "/"));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-3 font-display text-base font-semibold text-sidebar-accent-foreground">
              <CalendarCheck2 className="h-5 w-5 shrink-0 text-sidebar-primary" />
              <span className="group-data-[collapsible=icon]:hidden">Team CUL CRM</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((it) => (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                        <Link to={it.url}>
                          <it.icon className="h-4 w-4" />
                          <span>{it.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-2 pb-2 text-xs group-data-[collapsible=icon]:hidden">
              <p className="truncate font-medium text-sidebar-accent-foreground">{profile?.full_name}</p>
              <p className="truncate text-sidebar-foreground/70">{roles.map((r) => ROLE_LABEL[r]).join(", ")}</p>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                  <LogOut className="h-4 w-4" /> <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <NotificationsBell />
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function NotificationsBell() {
  const { userId, hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date();
      const in24 = new Date(now.getTime() + 24 * 3600_000).toISOString();
      const today = now.toISOString().slice(0, 10);
      let upQ = supabase.from("appointments").select("id, scheduled_at, clients(business_name)")
        .in("status", ["scheduled", "rescheduled"]).gte("scheduled_at", now.toISOString()).lte("scheduled_at", in24).eq("is_demo", false);
      if (!hasRole("admin")) upQ = hasRole("demo_staff") ? upQ.eq("demo_staff_id", userId!) : upQ.eq("booking_agent_id", userId!);
      const [n, up, fu] = await Promise.all([
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
        upQ,
        hasRole("admin") || hasRole("demo_staff")
          ? supabase.from("appointments").select("id", { count: "exact", head: true }).lt("follow_up_date", today).eq("outcome", "follow_up_required").eq("is_demo", false)
          : Promise.resolve({ count: 0 }),
      ]);
      return { list: n.data ?? [], upcoming: up.data ?? [], overdue: fu.count ?? 0 };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () =>
        qc.invalidateQueries({ queryKey: ["notifications", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const unread = (data?.list ?? []).filter((n) => !n.read_at).length;
  const badge = unread + (data?.upcoming.length ?? 0) + (data?.overdue ? 1 : 0);

  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{badge}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">Notifications</p>
          {unread > 0 && <button className="text-xs text-primary hover:underline" onClick={markAll}>Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data?.overdue ? (
            <button className="block w-full border-b bg-destructive/5 px-4 py-3 text-left text-sm" onClick={() => navigate({ to: "/follow-ups" })}>
              <p className="font-medium text-destructive">{data.overdue} overdue follow-up{data.overdue > 1 ? "s" : ""}</p>
            </button>
          ) : null}
          {data?.upcoming.map((u) => (
            <button key={u.id} className="block w-full border-b bg-info/5 px-4 py-3 text-left text-sm" onClick={() => navigate({ to: "/appointments/$id", params: { id: u.id } })}>
              <p className="font-medium">Upcoming demo: {u.clients?.business_name}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.scheduled_at), { addSuffix: true })}</p>
            </button>
          ))}
          {(data?.list ?? []).map((n) => (
            <button
              key={n.id}
              className={`block w-full border-b px-4 py-3 text-left text-sm hover:bg-muted ${n.read_at ? "opacity-60" : ""}`}
              onClick={async () => {
                if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
                qc.invalidateQueries({ queryKey: ["notifications", userId] });
                if (n.link) navigate({ to: n.link });
              }}
            >
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </button>
          ))}
          {!data?.list.length && !data?.upcoming.length && !data?.overdue && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
