import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "ClientDetails — DemoDesk CRM" }] }),
  component: ClientDetails,
});

function ClientDetails() {
  return <PageHeader title="ClientDetails" subtitle="This page is not built yet." />;
}
