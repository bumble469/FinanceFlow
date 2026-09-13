import { PlansPage } from "@/components/plans/plans-page";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "Plans - FinanceFlow",
  description: "Manage and view all your financial plans",
};

export default function PlansPageRoute() {
  return (
    <AppShell>
      <PlansPage />
    </AppShell>
  );
}