"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Download, FileCheck2, FileSpreadsheet, FileText, FolderOpen, RefreshCw, Trash2, Upload, X } from "lucide-react";

type Document = { id: string; filename: string; mimeType: string; size: number; status: "queued" | "stored" | "review"; source: string; createdAt: string; extractionJson?: string | null };
type Definition = { id: string; name: string };

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsClient({ initialDocuments, categories, accounts }: { initialDocuments: Document[]; categories: Definition[]; accounts: Definition[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const csvPicker = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<Array<Record<string, unknown>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [mapping, setMapping] = useState({ date: "", merchant: "", amount: "", debit: "", credit: "", category: "", account: "", dateFormat: "iso", amountConvention: "negative-expense" });
  const [reviewing, setReviewing] = useState<Document | null>(null);
  const [statementAlreadyStored, setStatementAlreadyStored] = useState(false);
  const [statementDocumentId, setStatementDocumentId] = useState<string | null>(null);
  const [driveInfo, setDriveInfo] = useState<{ lastSync?: { completedAt: string; status: string; stored: number; imported: number; duplicates: number; review: number; errors: string[] } | null }>({});
  const handledQuery = useRef(false);

  useEffect(() => {
    fetch("/api/drive-sync", { cache: "no-store" }).then((response) => response.json()).then(setDriveInfo).catch(() => undefined);
    if (handledQuery.current) return;
    handledQuery.current = true;
    const query = new URLSearchParams(window.location.search);
    if (query.get("drive") === "sync") void syncDrive();
    if (query.get("import") === "open") csvPicker.current?.click();
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setMessage("");
    const form = new FormData(); for (const file of Array.from(files)) form.append("files", file);
    const response = await fetch("/api/documents", { method: "POST", body: form });
    const result = await response.json(); setUploading(false);
    if (result.documents?.length) setDocuments((current) => [...result.documents, ...current]);
    setMessage(response.ok ? `${result.documents.length} document(s) stored${result.errors.length ? `; ${result.errors.length} failed` : ""}.` : result.error ?? result.errors?.[0]?.error ?? "Upload failed.");
    if (picker.current) picker.current.value = "";
  }

  async function remove(document: Document) {
    if (!window.confirm(`Delete Ledgerly's stored copy of “${document.filename}”?`)) return;
    const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
    if (response.ok) { setDocuments((current) => current.filter((item) => item.id !== document.id)); setMessage("Stored document deleted."); }
    else setMessage("The document could not be deleted.");
  }
  async function syncDrive() {
    setUploading(true); setMessage("");
    const response = await fetch("/api/drive-sync", { method: "POST" }); const result = await response.json();
    if (response.ok) { const state = await fetch("/api/state", { cache: "no-store" }).then((item) => item.json()); setDocuments(state.documents); setDriveInfo({ lastSync: result }); setMessage(`Drive checked: ${result.stored ?? 0} files stored, ${result.imported ?? 0} transactions imported, ${result.duplicates ?? 0} duplicates, ${result.review ?? 0} needing review.`); }
    else setMessage(result.error ?? "Drive sync failed."); setUploading(false);
  }

  async function openDriveFolder() {
    const response = await fetch("/api/drive-sync?action=open", { method: "POST" });
    setMessage(response.ok ? "Opened Ledgerly Financial Inbox in Finder." : "The Drive inbox could not be opened.");
  }

  function chooseHeader(names: string[], available: string[]) {
    return available.find((header) => names.includes(header.toLowerCase().replace(/[^a-z]/g, ""))) ?? "";
  }

  async function prepareStatement(file: File, alreadyStored = false) {
    try {
      let rows: Array<Record<string, unknown>>; let available: string[];
      if (/\.xlsx?$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const first = workbook.SheetNames[0];
        if (!first) throw new Error("No worksheet found.");
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: "" }).slice(0, 5000);
        available = Object.keys(rows[0] ?? {});
      } else {
        const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true, preview: 5000 });
        if (parsed.errors.length && !parsed.data.length) throw new Error("CSV parse failed.");
        rows = parsed.data; available = parsed.meta.fields ?? [];
      }
      if (!rows.length) throw new Error("No transaction rows found.");
      setCsvFile(file); setCsvRows(rows); setHeaders(available); setStatementAlreadyStored(alreadyStored); if (!alreadyStored) setStatementDocumentId(null);
      setMapping({ date: chooseHeader(["date", "transactiondate", "posteddate", "valuedate"], available), merchant: chooseHeader(["description", "merchant", "payee", "details", "memo", "narration", "particulars"], available), amount: chooseHeader(["amount", "transactionamount"], available), debit: chooseHeader(["debit", "withdrawal", "charge", "debitamount"], available), credit: chooseHeader(["credit", "deposit", "creditamount"], available), category: chooseHeader(["category"], available), account: chooseHeader(["account", "accountname"], available), dateFormat: "dmy", amountConvention: "negative-expense" });
      setCsvOpen(true);
    } catch { setMessage("Ledgerly could not read that statement file."); }
  }

  async function reviewStatement(document: Document) {
    const response = await fetch(`/api/documents/${document.id}`);
    if (!response.ok) { setMessage("The stored statement could not be opened."); return; }
    setStatementDocumentId(document.id);
    await prepareStatement(new File([await response.blob()], document.filename, { type: document.mimeType }), true);
  }

  async function importCsv(event: React.FormEvent) {
    event.preventDefault(); setUploading(true); setMessage("");
    const response = await fetch("/api/imports/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: csvRows, mapping, fallbackAccount: "Imported account" }) });
    const result = await response.json();
    if (!response.ok) { setUploading(false); setMessage(result.error ?? "CSV import failed."); return; }
    if (csvFile && !statementAlreadyStored) { const form = new FormData(); form.append("files", csvFile); const stored = await fetch("/api/documents", { method: "POST", body: form }).then((item) => item.json()); if (stored.documents?.length) setDocuments((current) => [...stored.documents, ...current]); }
    if (statementAlreadyStored && statementDocumentId) {
      await fetch(`/api/documents/${statementDocumentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ statementReviewed: true }) });
      setDocuments((current) => current.map((item) => item.id === statementDocumentId ? { ...item, status: "stored" } : item));
    }
    setUploading(false); setCsvOpen(false); setMessage(`Imported ${result.inserted}; duplicates ${result.duplicates}; skipped ${result.skipped}; needs review ${result.needsReview}.`);
  }

  async function confirmReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reviewing) return; setUploading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/documents/${reviewing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: form.get("date"), merchant: form.get("merchant"), amount: Number(form.get("amount")), type: form.get("type"), categoryId: form.get("categoryId"), accountId: form.get("accountId"), tags: [] }) });
    const result = await response.json(); setUploading(false);
    if (!response.ok) { setMessage(result.error ?? "Review could not be saved."); return; }
    setDocuments((current) => current.map((item) => item.id === reviewing.id ? { ...item, status: "stored", extractionJson: null } : item)); setReviewing(null); setMessage("Reviewed transaction created and linked to the document.");
  }

  return <div className="page">
    <section className="page-heading"><div><p className="eyebrow">Secure local vault</p><h1>Documents</h1><p>Store statements, receipts, and invoices privately on this Mac.</p></div></section>
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="feature-grid">
      <article className="panel feature-card"><div className="large-empty-icon"><Upload size={25} /></div><h2>Upload documents</h2><p>PDFs, images, CSVs, and spreadsheets up to 20 MB each. Images and PDFs are checked locally by Tesseract and Poppler.</p><input ref={picker} className="visually-hidden" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.txt" onChange={(e) => upload(e.target.files)} /><input ref={csvPicker} className="visually-hidden" type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && void prepareStatement(e.target.files[0])} /><div className="feature-actions"><button className="button primary" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={17} />{uploading ? "Processing…" : "Choose files"}</button><button className="button secondary" disabled={uploading} onClick={() => csvPicker.current?.click()}><FileSpreadsheet size={17} />Import statement</button></div></article>
      <article className="panel feature-card"><div className="large-empty-icon drive"><FolderOpen size={25} /></div><h2>Google Drive inbox</h2><p>Ledgerly Financial Inbox · daily at 8:00 AM · originals are never changed.</p>{driveInfo.lastSync ? <p className="drive-summary">Last sync {new Date(driveInfo.lastSync.completedAt).toLocaleString()} · {driveInfo.lastSync.status} · {driveInfo.lastSync.imported} imported · {driveInfo.lastSync.duplicates} duplicates · {driveInfo.lastSync.review} review</p> : <p className="drive-summary">No completed sync recorded yet.</p>}<div className="feature-actions"><button className="button secondary" onClick={openDriveFolder}><FolderOpen size={17} />Open in Finder</button><button className="button secondary" disabled={uploading} onClick={syncDrive}><RefreshCw size={17} />{uploading ? "Checking…" : "Run Drive sync"}</button></div></article>
    </section>
    <article className="panel vault-panel"><div className="panel-heading"><div><p className="eyebrow">Stored privately</p><h2>Document vault</h2></div><span className="vault-count">{documents.length} files</span></div>{documents.length === 0 ? <div className="empty-list"><FileText size={25} /><h3>No documents yet</h3><p>Upload a file or add one to your Drive inbox.</p></div> : <div className="document-list">{documents.map((document) => <article key={document.id}><div className="document-icon"><FileCheck2 size={19} /></div><div><strong>{document.filename}</strong><span>{fileSize(document.size)} · {document.source} · {new Date(document.createdAt).toLocaleDateString()}</span></div><span className={`status-pill ${document.status}`}>{document.status}</span><div className="document-actions">{document.status === "review" && <button className="button review-button" onClick={() => document.mimeType.includes("csv") || document.mimeType.includes("spreadsheet") || document.mimeType.includes("excel") ? void reviewStatement(document) : setReviewing(document)}>Review</button>}<a className="icon-button small" href={`/api/documents/${document.id}`} aria-label={`Download ${document.filename}`}><Download size={15} /></a><button className="icon-button small" onClick={() => remove(document)} aria-label={`Delete ${document.filename}`}><Trash2 size={15} /></button></div></article>)}</div>}</article>
    {csvOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCsvOpen(false); }}><div className="modal csv-modal" role="dialog" aria-modal="true" aria-labelledby="csv-title"><div className="modal-heading"><div><p className="eyebrow">Statement import</p><h2 id="csv-title">Map CSV columns</h2><p>{csvFile?.name} · {csvRows.length} rows detected</p></div><button className="icon-button" aria-label="Close" onClick={() => setCsvOpen(false)}><X /></button></div><form onSubmit={importCsv}><div className="form-grid"><MapSelect label="Date" value={mapping.date} headers={headers} required onChange={(date) => setMapping({ ...mapping, date })} /><MapSelect label="Merchant / description" value={mapping.merchant} headers={headers} required onChange={(merchant) => setMapping({ ...mapping, merchant })} /><MapSelect label="Amount" value={mapping.amount} headers={headers} onChange={(amount) => setMapping({ ...mapping, amount })} /><MapSelect label="Debit" value={mapping.debit} headers={headers} onChange={(debit) => setMapping({ ...mapping, debit })} /><MapSelect label="Credit" value={mapping.credit} headers={headers} onChange={(credit) => setMapping({ ...mapping, credit })} /><MapSelect label="Category" value={mapping.category} headers={headers} onChange={(category) => setMapping({ ...mapping, category })} /><MapSelect label="Account" value={mapping.account} headers={headers} onChange={(account) => setMapping({ ...mapping, account })} /><label>Date format<select value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value })}><option value="iso">YYYY-MM-DD</option><option value="mdy">MM/DD/YYYY</option><option value="dmy">DD/MM/YYYY</option></select></label><label>Signed amount meaning<select value={mapping.amountConvention} onChange={(e) => setMapping({ ...mapping, amountConvention: e.target.value })}><option value="negative-expense">Negative means expense</option><option value="positive-expense">Positive means expense</option></select></label></div><div className="csv-preview"><strong>Preview</strong><div>{headers.slice(0, 5).map((header) => <span key={header}>{header}: {String(csvRows[0]?.[header] ?? "—")}</span>)}</div></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setCsvOpen(false)}>Cancel</button><button className="button primary" disabled={uploading}>{uploading ? "Importing…" : "Import transactions"}</button></div></form></div></div>}
    {reviewing && <ReviewModal document={reviewing} categories={categories} accounts={accounts} saving={uploading} onClose={() => setReviewing(null)} onSubmit={confirmReview} />}
  </div>;
}

function ReviewModal({ document, categories, accounts, saving, onClose, onSubmit }: { document: Document; categories: Definition[]; accounts: Definition[]; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  let extraction: { merchantCandidate?: string; dateCandidate?: string; totalCandidate?: string } = {};
  try { extraction = JSON.parse(document.extractionJson ?? "{}"); } catch { /* review starts blank */ }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="modal-heading"><div><p className="eyebrow">Confirm every field</p><h2 id="review-title">Review extraction</h2><p>OCR suggestions are not saved as a transaction until you confirm.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X /></button></div><form onSubmit={onSubmit}><div className="form-grid"><label className="wide">Merchant or payee<input name="merchant" required defaultValue={extraction.merchantCandidate ?? ""} /></label><label>Date<input name="date" type="date" required defaultValue={extraction.dateCandidate ?? ""} /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={extraction.totalCandidate ?? ""} /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Category<select name="categoryId">{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Account<select name="accountId">{accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Confirm transaction"}</button></div></form></div></div>;
}

function MapSelect({ label, value, headers, required, onChange }: { label: string; value: string; headers: string[]; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} required={required} onChange={(e) => onChange(e.target.value)}><option value="">Not mapped</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>;
}
