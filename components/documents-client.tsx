"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Download, FileCheck2, FileSpreadsheet, FileText, FolderOpen, RefreshCw, Trash2, Upload, X } from "lucide-react";

type Document = { id: string; filename: string; mimeType: string; size: number; status: "queued" | "stored" | "review"; source: string; createdAt: string };

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsClient({ initialDocuments }: { initialDocuments: Document[] }) {
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

  function chooseHeader(names: string[], available: string[]) {
    return available.find((header) => names.includes(header.toLowerCase().replace(/[^a-z]/g, ""))) ?? "";
  }

  function prepareCsv(file: File) {
    Papa.parse<Record<string, unknown>>(file, { header: true, skipEmptyLines: true, preview: 5000, complete(result) {
      const available = result.meta.fields ?? [];
      setCsvFile(file); setCsvRows(result.data); setHeaders(available);
      setMapping({ date: chooseHeader(["date", "transactiondate", "posteddate"], available), merchant: chooseHeader(["description", "merchant", "payee", "details", "memo"], available), amount: chooseHeader(["amount", "transactionamount"], available), debit: chooseHeader(["debit", "withdrawal", "charge"], available), credit: chooseHeader(["credit", "deposit"], available), category: chooseHeader(["category"], available), account: chooseHeader(["account", "accountname"], available), dateFormat: "iso", amountConvention: "negative-expense" });
      setCsvOpen(true);
    }, error() { setMessage("Ledgerly could not read that CSV file."); } });
  }

  async function importCsv(event: React.FormEvent) {
    event.preventDefault(); setUploading(true); setMessage("");
    const response = await fetch("/api/imports/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: csvRows, mapping, fallbackAccount: "Imported account" }) });
    const result = await response.json();
    if (!response.ok) { setUploading(false); setMessage(result.error ?? "CSV import failed."); return; }
    if (csvFile) { const form = new FormData(); form.append("files", csvFile); const stored = await fetch("/api/documents", { method: "POST", body: form }).then((item) => item.json()); if (stored.documents?.length) setDocuments((current) => [...stored.documents, ...current]); }
    setUploading(false); setCsvOpen(false); setMessage(`Imported ${result.inserted}; duplicates ${result.duplicates}; skipped ${result.skipped}; needs review ${result.needsReview}.`);
  }

  return <div className="page">
    <section className="page-heading"><div><p className="eyebrow">Secure local vault</p><h1>Documents</h1><p>Store statements, receipts, and invoices privately on this Mac.</p></div></section>
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="feature-grid">
      <article className="panel feature-card"><div className="large-empty-icon"><Upload size={25} /></div><h2>Upload documents</h2><p>PDFs, images, CSVs, and spreadsheets up to 20 MB each. Images and PDFs are checked locally by Tesseract and Poppler.</p><input ref={picker} className="visually-hidden" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.xls,.xlsx,.txt" onChange={(e) => upload(e.target.files)} /><input ref={csvPicker} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && prepareCsv(e.target.files[0])} /><div className="feature-actions"><button className="button primary" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={17} />{uploading ? "Processing…" : "Choose files"}</button><button className="button secondary" disabled={uploading} onClick={() => csvPicker.current?.click()}><FileSpreadsheet size={17} />Import CSV</button></div></article>
      <article className="panel feature-card"><div className="large-empty-icon drive"><FolderOpen size={25} /></div><h2>Google Drive inbox</h2><p>Google Drive is mounted. The dedicated inbox will be resolved before the scheduled importer is enabled.</p><button className="button secondary" disabled><RefreshCw size={17} />Not configured</button></article>
    </section>
    <article className="panel vault-panel"><div className="panel-heading"><div><p className="eyebrow">Stored privately</p><h2>Document vault</h2></div><span className="vault-count">{documents.length} files</span></div>{documents.length === 0 ? <div className="empty-list"><FileText size={25} /><h3>No documents yet</h3><p>Upload a file or add one to your Drive inbox.</p></div> : <div className="document-list">{documents.map((document) => <article key={document.id}><div className="document-icon"><FileCheck2 size={19} /></div><div><strong>{document.filename}</strong><span>{fileSize(document.size)} · {document.source} · {new Date(document.createdAt).toLocaleDateString()}</span></div><span className={`status-pill ${document.status}`}>{document.status}</span><div className="document-actions"><a className="icon-button small" href={`/api/documents/${document.id}`} aria-label={`Download ${document.filename}`}><Download size={15} /></a><button className="icon-button small" onClick={() => remove(document)} aria-label={`Delete ${document.filename}`}><Trash2 size={15} /></button></div></article>)}</div>}</article>
    {csvOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCsvOpen(false); }}><div className="modal csv-modal" role="dialog" aria-modal="true" aria-labelledby="csv-title"><div className="modal-heading"><div><p className="eyebrow">Statement import</p><h2 id="csv-title">Map CSV columns</h2><p>{csvFile?.name} · {csvRows.length} rows detected</p></div><button className="icon-button" aria-label="Close" onClick={() => setCsvOpen(false)}><X /></button></div><form onSubmit={importCsv}><div className="form-grid"><MapSelect label="Date" value={mapping.date} headers={headers} required onChange={(date) => setMapping({ ...mapping, date })} /><MapSelect label="Merchant / description" value={mapping.merchant} headers={headers} required onChange={(merchant) => setMapping({ ...mapping, merchant })} /><MapSelect label="Amount" value={mapping.amount} headers={headers} onChange={(amount) => setMapping({ ...mapping, amount })} /><MapSelect label="Debit" value={mapping.debit} headers={headers} onChange={(debit) => setMapping({ ...mapping, debit })} /><MapSelect label="Credit" value={mapping.credit} headers={headers} onChange={(credit) => setMapping({ ...mapping, credit })} /><MapSelect label="Category" value={mapping.category} headers={headers} onChange={(category) => setMapping({ ...mapping, category })} /><MapSelect label="Account" value={mapping.account} headers={headers} onChange={(account) => setMapping({ ...mapping, account })} /><label>Date format<select value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value })}><option value="iso">YYYY-MM-DD</option><option value="mdy">MM/DD/YYYY</option><option value="dmy">DD/MM/YYYY</option></select></label><label>Signed amount meaning<select value={mapping.amountConvention} onChange={(e) => setMapping({ ...mapping, amountConvention: e.target.value })}><option value="negative-expense">Negative means expense</option><option value="positive-expense">Positive means expense</option></select></label></div><div className="csv-preview"><strong>Preview</strong><div>{headers.slice(0, 5).map((header) => <span key={header}>{header}: {String(csvRows[0]?.[header] ?? "—")}</span>)}</div></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setCsvOpen(false)}>Cancel</button><button className="button primary" disabled={uploading}>{uploading ? "Importing…" : "Import transactions"}</button></div></form></div></div>}
  </div>;
}

function MapSelect({ label, value, headers, required, onChange }: { label: string; value: string; headers: string[]; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} required={required} onChange={(e) => onChange(e.target.value)}><option value="">Not mapped</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>;
}
