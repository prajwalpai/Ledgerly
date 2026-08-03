"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, IndianRupee, Plus, Search, Tag, Trash2, X } from "lucide-react";

type Definition = { id: string; name: string };
type Transaction = {
  id: string; date: string; merchant: string; categoryId: string | null; categoryLabel: string;
  amountCents: number; type: "expense" | "income"; accountId: string | null; accountLabel: string;
  receipt: number; source: string; tags: string | Array<{ id: string; name: string }>;
};
type State = { transactions: Transaction[]; categories: Definition[]; accounts: Definition[]; tags: Array<Definition & { usageCount: number }> };

function parseTags(value: Transaction["tags"]) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value) as Array<{ id: string; name: string }>; } catch { return []; }
}

function today() { return new Date().toLocaleDateString("en-CA"); }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function TransactionsClient({ initialState }: { initialState: State }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState(initialState);
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [modalOpen, setModalOpen] = useState(searchParams.get("add") === "open");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tagEditor, setTagEditor] = useState<Transaction | null>(null);
  const [receiptEnabled, setReceiptEnabled] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modalOpen]);

  const filtered = useMemo(() => state.transactions.filter((transaction) => {
    const tags = parseTags(transaction.tags).map((tag) => tag.name).join(" ");
    const haystack = `${transaction.merchant} ${transaction.categoryLabel} ${tags}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (account === "all" || transaction.accountId === account) && (category === "all" || transaction.categoryId === category);
  }), [state.transactions, query, account, category]);

  async function reload() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) setState(await response.json());
    router.refresh();
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const receiptFile = form.get("receiptFile");
    const response = await fetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      type: form.get("type"), amount: Number(form.get("amount")), merchant: form.get("merchant"), date: form.get("date"), categoryId: form.get("categoryId"), accountId: form.get("accountId"), tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean), receipt: form.get("receipt") === "on", source: "manual",
    }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "Could not save the transaction."); return; }
    const transactionId = result.rows?.[0]?.id as string | undefined;
    if (receiptFile instanceof File && receiptFile.size > 0 && transactionId) {
      setSaving(true);
      const upload = new FormData(); upload.append("files", receiptFile); upload.append("transactionId", transactionId);
      const documentResponse = await fetch("/api/documents", { method: "POST", body: upload });
      setSaving(false);
      if (!documentResponse.ok) {
        await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
        setMessage("The receipt could not be stored, so the transaction was not saved.");
        return;
      }
    }
    setModalOpen(false); await reload();
  }

  async function updateCategory(transactionId: string, categoryId: string) {
    const previous = state;
    const selected = state.categories.find((item) => item.id === categoryId);
    if (!selected) return;
    setState({ ...state, transactions: state.transactions.map((row) => row.id === transactionId ? { ...row, categoryId, categoryLabel: selected.name } : row) });
    const response = await fetch(`/api/transactions/${transactionId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId }) });
    if (!response.ok) { setState(previous); setMessage("The category change could not be saved."); }
  }

  async function removeTag(transaction: Transaction, tagId: string) {
    const remaining = parseTags(transaction.tags).filter((tag) => tag.id !== tagId);
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: remaining.map((tag) => tag.name) }) });
    if (response.ok) setState({ ...state, transactions: state.transactions.map((row) => row.id === transaction.id ? { ...row, tags: remaining } : row) });
    else setMessage("The tag could not be removed.");
  }

  async function saveTags(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!tagEditor) return;
    const data = new FormData(event.currentTarget);
    const selected = data.getAll("existing").map(String);
    const created = String(data.get("newTag") ?? "").trim();
    if (created) selected.push(created);
    const response = await fetch(`/api/transactions/${tagEditor.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: selected }) });
    if (!response.ok) { setMessage("The tags could not be saved."); return; }
    setTagEditor(null); await reload();
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete the transaction for “${transaction.merchant}”?`)) return;
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
    if (!response.ok) { setMessage("The transaction could not be deleted."); return; }
    setState({ ...state, transactions: state.transactions.filter((row) => row.id !== transaction.id) }); router.refresh();
  }

  return <div className="page">
    <section className="page-heading"><div><p className="eyebrow">Activity</p><h1>Transactions</h1><p>Search, review, and organize every saved transaction.</p></div><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={18} />Add entry</button></section>
    {message && <p className="inline-message" role="alert">{message}</p>}
    <section className="panel transaction-panel">
      <div className="filters"><label className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchant, category, or tag" /></label><select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Filter by account"><option value="all">All accounts</option>{state.accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{state.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      {filtered.length === 0 ? <div className="empty-list transaction-empty"><IndianRupee size={25} /><h3>{state.transactions.length ? "No matching transactions" : "No transactions yet"}</h3><p>{state.transactions.length ? "Try changing your search or filters." : "Add an entry or import a statement to begin."}</p></div> : <div className="transaction-list">{filtered.map((transaction) => <article className="transaction-row" key={transaction.id}><div className="transaction-main"><strong>{transaction.merchant}</strong><span>{transaction.date} · {transaction.accountLabel}</span></div><select value={transaction.categoryId ?? ""} onChange={(e) => updateCategory(transaction.id, e.target.value)} aria-label={`Category for ${transaction.merchant}`}>{state.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><div className="tag-list">{parseTags(transaction.tags).map((tag) => <button title={`Remove ${tag.name}`} onClick={() => removeTag(transaction, tag.id)} key={tag.id}><Tag size={12} />{tag.name}<X size={12} /></button>)}<button className="add-tag" onClick={() => setTagEditor(transaction)} title="Edit tags"><Plus size={13} /></button></div><div className="row-actions"><strong className={transaction.type === "income" ? "amount income" : "amount"}>{transaction.type === "income" ? "+" : "−"}{money.format(transaction.amountCents / 100)}</strong><button className="icon-button small" aria-label={`Delete ${transaction.merchant}`} onClick={() => removeTransaction(transaction)}><Trash2 size={14} /></button></div></article>)}</div>}
    </section>
    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-entry-title"><div className="modal-heading"><div><p className="eyebrow">New transaction</p><h2 id="add-entry-title">Add entry</h2></div><button className="icon-button" aria-label="Close" onClick={() => setModalOpen(false)}><X /></button></div><form onSubmit={add}><div className="form-grid"><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label><label className="wide">Merchant or source<input name="merchant" required maxLength={180} autoFocus placeholder="Enter a name" /></label><label>Date<input name="date" type="date" defaultValue={today()} required /></label><label>Category<select name="categoryId" required>{state.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Account<select name="accountId" required>{state.accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="wide">Tags <span>(comma separated)</span><input name="tags" placeholder="Travel, Reimbursable" /></label><label className="check wide"><input name="receipt" type="checkbox" checked={receiptEnabled} onChange={(e) => setReceiptEnabled(e.target.checked)} />I have a receipt to attach</label>{receiptEnabled && <label className="wide">Receipt file<input name="receiptFile" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff" /></label>}</div>{message && <p className="form-error">{message}</p>}<div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving} type="submit">{saving ? "Saving…" : <><CheckCircle2 size={17} />Save entry</>}</button></div></form></div></div>}
    {tagEditor && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setTagEditor(null); }}><div className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="tag-title"><div className="modal-heading"><div><p className="eyebrow">Transaction tags</p><h2 id="tag-title">Edit tags</h2></div><button className="icon-button" aria-label="Close" onClick={() => setTagEditor(null)}><X /></button></div><form onSubmit={saveTags}><div className="tag-choices">{state.tags.length ? state.tags.map((tag) => <label key={tag.id}><input type="checkbox" name="existing" value={tag.name} defaultChecked={parseTags(tagEditor.tags).some((current) => current.id === tag.id)} />{tag.name}</label>) : <p>No saved tags yet.</p>}</div><label className="new-tag-field">Create one new tag<input name="newTag" maxLength={60} placeholder="Tag name" /></label><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setTagEditor(null)}>Cancel</button><button className="button primary" type="submit">Save tags</button></div></form></div></div>}
  </div>;
}
