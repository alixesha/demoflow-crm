import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({ meta: [{ title: "FollowUps — DemoDesk CRM" }] }),
  component: FollowUps,
});

function FollowUps() {
  return <PageHeader title="FollowUps" subtitle="This page is not built yet." />;
}
