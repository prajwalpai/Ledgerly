"use client";

import { useRef, useState } from "react";
import { Download, FileCheck2, FileText, FolderOpen, RefreshCw, Trash2, Upload } from "lucide-react";

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

  return <div className="page">
    <section className="page-heading"><div><p className="eyebrow">Secure local vault</p><h1>Documents</h1><p>Store statements, receipts, and invoices privately on this Mac.</p></div></section>
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="feature-grid">
      <article className="panel feature-card"><div className="large-empty-icon"><Upload size={25} /></div><h2>Upload documents</h2><p>PDFs, images, CSVs, and spreadsheets up to 20 MB each. Images and PDFs are checked locally by Tesseract and Poppler.</p><input ref={picker} className="visually-hidden" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.csv,.xls,.xlsx,.txt" onChange={(e) => upload(e.target.files)} /><button className="button primary" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={17} />{uploading ? "Processing…" : "Choose files"}</button></article>
      <article className="panel feature-card"><div className="large-empty-icon drive"><FolderOpen size={25} /></div><h2>Google Drive inbox</h2><p>Google Drive is mounted. The dedicated inbox will be resolved before the scheduled importer is enabled.</p><button className="button secondary" disabled><RefreshCw size={17} />Not configured</button></article>
    </section>
    <article className="panel vault-panel"><div className="panel-heading"><div><p className="eyebrow">Stored privately</p><h2>Document vault</h2></div><span className="vault-count">{documents.length} files</span></div>{documents.length === 0 ? <div className="empty-list"><FileText size={25} /><h3>No documents yet</h3><p>Upload a file or add one to your Drive inbox.</p></div> : <div className="document-list">{documents.map((document) => <article key={document.id}><div className="document-icon"><FileCheck2 size={19} /></div><div><strong>{document.filename}</strong><span>{fileSize(document.size)} · {document.source} · {new Date(document.createdAt).toLocaleDateString()}</span></div><span className={`status-pill ${document.status}`}>{document.status}</span><div className="document-actions"><a className="icon-button small" href={`/api/documents/${document.id}`} aria-label={`Download ${document.filename}`}><Download size={15} /></a><button className="icon-button small" onClick={() => remove(document)} aria-label={`Delete ${document.filename}`}><Trash2 size={15} /></button></div></article>)}</div>}</article>
  </div>;
}
