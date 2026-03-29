import { SettingsClient } from "@/components/SettingsClient";
import { SettingsTopBar } from "@/components/SettingsTopBar";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] comfy-grid">
      <SettingsTopBar />
      <main className="flex flex-1 flex-col py-6">
        <SettingsClient />
      </main>
    </div>
  );
}
