import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — DemoDesk CRM" }] }),
  component: Clients,
});

function Clients() {
  return <PageHeader title="Clients" subtitle="This page is not built yet." />;
}
