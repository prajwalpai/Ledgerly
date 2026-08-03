import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftRight, IndianRupee, FileText, FolderOpen, Plus, RefreshCw,
  Settings, Sparkles, Target, Tags, Upload, WalletCards, WandSparkles,
} from "lucide-react";
import { getState } from "@/lib/queries";
import { EntityManager } from "@/components/entity-manager";

export const dynamic = "force-dynamic";

const sections = {
  transactions: {
    eyebrow: "Activity", title: "Transactions", description: "Search, review, and organize every saved transaction.",
    icon: ArrowLeftRight, emptyTitle: "No transactions yet", emptyBody: "Add an entry or import a statement to begin your ledger.", action: "Add entry",
  },
  recurring: {
    eyebrow: "Automatic detection", title: "Recurring", description: "Review repeating bills and plan for what comes next.",
    icon: RefreshCw, emptyTitle: "No recurring payments yet", emptyBody: "Suggestions will appear after Ledgerly finds a stable pattern in real expenses.", action: "Add recurring payment",
  },
  subscriptions: {
    eyebrow: "Commitments", title: "Subscriptions", description: "See renewals and the real monthly cost of your services.",
    icon: IndianRupee, emptyTitle: "No subscriptions yet", emptyBody: "Keep a detected suggestion or add a subscription manually.", action: "Add subscription",
  },
  budgets: {
    eyebrow: "Plan", title: "Budgets", description: "Set category limits and compare them with real monthly spending.",
    icon: WalletCards, emptyTitle: "Create your first budget", emptyBody: "Budget progress will be calculated only from saved expenses.", action: "Create budget",
  },
  goals: {
    eyebrow: "Save with purpose", title: "Goals", description: "Track progress toward the things that matter to you.",
    icon: Target, emptyTitle: "No goals yet", emptyBody: "Create a goal with a target amount and build from there.", action: "Create goal",
  },
  rules: {
    eyebrow: "Organize", title: "Rules & tags", description: "Create simple rules for future imports and manage reusable tags.",
    icon: WandSparkles, emptyTitle: "No categorization rules", emptyBody: "Rules apply only to new imports after duplicate detection.", action: "Create rule",
  },
} as const;

function EmptyPanel({ section }: { section: (typeof sections)[keyof typeof sections] }) {
  const Icon = section.icon;
  return (
    <article className="panel section-empty">
      <div className="large-empty-icon"><Icon size={27} /></div>
      <h2>{section.emptyTitle}</h2>
      <p>{section.emptyBody}</p>
      <button className="button primary" type="button"><Plus size={17} />{section.action}</button>
    </article>
  );
}

function DocumentsPage() {
  return (
    <div className="page">
      <section className="page-heading"><div><p className="eyebrow">Secure local vault</p><h1>Documents</h1><p>Store statements, receipts, and invoices privately on this Mac.</p></div></section>
      <section className="feature-grid">
        <article className="panel feature-card"><div className="large-empty-icon"><Upload size={25} /></div><h2>Upload documents</h2><p>PDFs, images, CSVs, and spreadsheets up to 20 MB each.</p><button className="button primary" type="button"><Upload size={17} />Choose files</button></article>
        <article className="panel feature-card"><div className="large-empty-icon drive"><FolderOpen size={25} /></div><h2>Google Drive inbox</h2><p>The dedicated synchronized folder will be connected during Drive setup.</p><Link className="button secondary" href="/settings"><Settings size={17} />View setup</Link></article>
      </section>
      <article className="panel vault-panel"><div className="panel-heading"><div><p className="eyebrow">Stored privately</p><h2>Document vault</h2></div></div><div className="empty-list"><FileText size={25} /><h3>No documents yet</h3><p>Upload a file or add one to your Drive inbox.</p></div></article>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page">
      <section className="page-heading"><div><p className="eyebrow">Local preferences</p><h1>Settings</h1><p>Manage definitions, storage, detection, and your Drive inbox.</p></div></section>
      <section className="settings-grid">
        <article className="panel setting-card"><div className="large-empty-icon"><Sparkles size={23} /></div><div><h2>Net worth setup</h2><p>Not configured. Add total assets and liabilities when you are ready.</p></div></article>
        <article className="panel setting-card"><div className="large-empty-icon"><Tags size={23} /></div><div><h2>Categories, tags & accounts</h2><p>Starter definitions are ready and contain no balances or transactions.</p></div></article>
        <article className="panel setting-card"><div className="large-empty-icon drive"><FolderOpen size={23} /></div><div><h2>Google Drive sync</h2><p>Folder discovery and the 8:00 AM schedule have not been configured yet.</p></div></article>
        <article className="panel setting-card"><div className="large-empty-icon"><Settings size={23} /></div><div><h2>Application health</h2><p>SQLite and OCR readiness will appear here after the health endpoint is connected.</p></div></article>
      </section>
    </div>
  );
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "documents") return <DocumentsPage />;
  if (section === "settings") return <SettingsPage />;
  if (["budgets", "goals", "subscriptions", "recurring", "rules"].includes(section)) {
    const state = getState();
    const items = section === "recurring" ? state.recurring : state[section as "budgets" | "goals" | "subscriptions" | "rules"];
    return <EntityManager kind={section as "budgets" | "goals" | "subscriptions" | "recurring" | "rules"} initialItems={JSON.parse(JSON.stringify(items))} categories={JSON.parse(JSON.stringify(state.categories))} accounts={JSON.parse(JSON.stringify(state.accounts))} suggestions={JSON.parse(JSON.stringify(state.detectionSuggestions))} />;
  }
  if (!(section in sections)) notFound();
  const definition = sections[section as keyof typeof sections];
  return (
    <div className="page">
      <section className="page-heading"><div><p className="eyebrow">{definition.eyebrow}</p><h1>{definition.title}</h1><p>{definition.description}</p></div></section>
      <EmptyPanel section={definition} />
    </div>
  );
}
