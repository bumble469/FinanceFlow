import { SettingsTabs } from "@/components/settings/settings-tabs";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "Settings - FinanceFlow",
  description: "Manage account settings",
};

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsTabs />
    </AppShell>
  );
}