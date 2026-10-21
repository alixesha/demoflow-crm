import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DemoDesk CRM" }] }),
  component: Settings,
});

function Settings() {
  return <PageHeader title="Settings" subtitle="This page is not built yet." />;
}
