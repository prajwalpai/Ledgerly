"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Period } from "@/lib/queries";

export function PeriodSelect({ value }: { value: Period }) {
  const router = useRouter();
  const [selected, setSelected] = useState(value);
  const [saving, setSaving] = useState(false);

  async function change(next: Period) {
    const previous = selected;
    setSelected(next);
    setSaving(true);
    const response = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedPeriod: next }),
    });
    setSaving(false);
    if (!response.ok) {
      setSelected(previous);
      window.alert("Ledgerly could not save that period.");
      return;
    }
    router.refresh();
  }

  return (
    <label className="period-field">Period
      <select value={selected} disabled={saving} onChange={(event) => change(event.target.value as Period)} aria-label="Dashboard period">
        <option value="all-time">All time</option><option value="this-month">This month</option><option value="last-month">Last month</option><option value="last-3-months">Last 3 months</option><option value="last-6-months">Last 6 months</option><option value="this-year">This year</option>
      </select>
    </label>
  );
}
