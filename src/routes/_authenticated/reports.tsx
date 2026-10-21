import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — DemoDesk CRM" }] }),
  component: Reports,
});

function Reports() {
  return <PageHeader title="Reports" subtitle="This page is not built yet." />;
}
