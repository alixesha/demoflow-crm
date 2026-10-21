import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DemoDesk CRM" }] }),
  component: Dashboard,
});

function Dashboard() {
  return <PageHeader title="Dashboard" subtitle="This page is not built yet." />;
}
