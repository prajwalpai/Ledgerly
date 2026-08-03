"use client";

import { useState } from "react";
import { CheckCircle2, FolderOpen, HeartPulse, Plus, Save, Tags, Trash2, WalletCards } from "lucide-react";

type Item = { id: string; name: string; usageCount?: number };
type State = { categories: Item[]; accounts: Item[]; tags: Item[]; settings: Record<string, unknown> };
type Kind = "categories" | "accounts" | "tags";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function SettingsClient({ initialState }: { initialState: State }) {
  const [state, setState] = useState(initialState);
  const [assets, setAssets] = useState(Number(state.settings.assetsCents ?? 0) / 100);
  const [liabilities, setLiabilities] = useState(Number(state.settings.liabilitiesCents ?? 0) / 100);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveNetWorth(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetsCents: Math.round(assets * 100), liabilitiesCents: Math.round(liabilities * 100), netWorthConfigured: true }) });
    setSaving(false); setMessage(response.ok ? "Net worth settings saved." : "Ledgerly could not save Net Worth settings.");
  }

  async function addDefinition(kind: Kind, form: HTMLFormElement) {
    const data = new FormData(form); const name = String(data.get("name") ?? "");
    const response = await fetch(`/api/definitions/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setState({ ...state, [kind]: [...state[kind], result.item].sort((a, b) => a.name.localeCompare(b.name)) }); form.reset(); setMessage(`${result.item.name} added.`);
  }

  async function removeDefinition(kind: Kind, item: Item) {
    if (!window.confirm(`Remove “${item.name}” from future selectors? Historical labels will be preserved.`)) return;
    let response = await fetch(`/api/definitions/${kind}?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (response.status === 409 && kind === "tags") {
      const result = await response.json();
      if (!result.confirmationRequired || !window.confirm(`“${item.name}” is used ${result.usageCount} time(s). Strip it from historical transactions too?`)) return;
      response = await fetch(`/api/definitions/${kind}?id=${encodeURIComponent(item.id)}&stripHistorical=true`, { method: "DELETE" });
    }
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "Could not remove that item."); return; }
    setState({ ...state, [kind]: state[kind].filter((entry) => entry.id !== item.id) }); setMessage(`${item.name} removed.`);
  }

  return <div className="page settings-page">
    <section className="page-heading"><div><p className="eyebrow">Local preferences</p><h1>Settings</h1><p>Manage definitions, storage, detection, and your Drive inbox.</p></div></section>
    {message && <p className="inline-message success" role="status"><CheckCircle2 size={16} />{message}</p>}
    <section className="settings-grid">
      <article className="panel settings-section net-worth-section"><div className="section-title"><div className="large-empty-icon"><WalletCards size={23} /></div><div><h2>Net worth setup</h2><p>Net Worth is total assets minus total liabilities—not monthly cash flow.</p></div></div><form onSubmit={saveNetWorth}><div className="form-grid"><label>Total assets<input type="number" min="0" step="0.01" value={assets} onChange={(e) => setAssets(Number(e.target.value))} /></label><label>Total liabilities<input type="number" min="0" step="0.01" value={liabilities} onChange={(e) => setLiabilities(Number(e.target.value))} /></label></div><div className="net-preview"><span>Live preview</span><strong>{money.format(assets - liabilities)}</strong></div><button className="button primary" disabled={saving}><Save size={17} />{saving ? "Saving…" : "Save Net Worth"}</button></form></article>
      <article className="panel settings-section"><div className="section-title"><div className="large-empty-icon drive"><FolderOpen size={23} /></div><div><h2>Google Drive sync</h2><p>The synchronized root is available. Inbox selection and scheduling come in the Drive phase.</p></div></div><dl className="status-list"><div><dt>Schedule</dt><dd>Not configured</dd></div><div><dt>OCR tools</dt><dd className="ready">Ready</dd></div></dl></article>
    </section>
    <section className="definition-grid">{(["categories", "accounts", "tags"] as Kind[]).map((kind) => <article className="panel definition-card" key={kind}><div className="section-title"><div className="large-empty-icon">{kind === "tags" ? <Tags size={22} /> : <Plus size={22} />}</div><div><h2>{kind[0].toUpperCase() + kind.slice(1)}</h2><p>{kind === "tags" ? "Reusable labels independent from categories." : `Names available in future ${kind === "accounts" ? "account" : "category"} pickers.`}</p></div></div><form className="definition-form" onSubmit={(e) => { e.preventDefault(); addDefinition(kind, e.currentTarget); }}><input name="name" required maxLength={80} placeholder={`Add ${kind.slice(0, -1)}`} aria-label={`New ${kind.slice(0, -1)} name`} /><button className="button secondary"><Plus size={17} />Add</button></form><div className="definition-list">{state[kind].map((item) => <div key={item.id}><span>{item.name}{kind === "tags" && <small>{item.usageCount ?? 0} uses</small>}</span><button className="icon-button small" aria-label={`Remove ${item.name}`} onClick={() => removeDefinition(kind, item)}><Trash2 size={15} /></button></div>)}</div></article>)}</section>
    <article className="panel settings-section health-card"><div className="section-title"><div className="large-empty-icon"><HeartPulse size={23} /></div><div><h2>Application health</h2><p>SQLite, Tesseract, Poppler, and the Google Drive mount passed the latest readiness check.</p></div></div></article>
  </div>;
}
