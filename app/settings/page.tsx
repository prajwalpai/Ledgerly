import { getState } from "@/lib/queries";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsClient initialState={JSON.parse(JSON.stringify(getState()))} />;
}
