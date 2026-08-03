"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, RefreshCw, IndianRupee, WalletCards,
  Target, FileText, WandSparkles, Settings, Upload, Plus, HardDrive,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/subscriptions", label: "Subscriptions", icon: IndianRupee },
  { href: "/budgets", label: "Budgets", icon: WalletCards },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/rules", label: "Rules", icon: WandSparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItems({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return navigation.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link className={`nav-link${active ? " active" : ""}${mobile ? " mobile" : ""}`} href={href} key={href}>
        <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
        <span>{label}</span>
      </Link>
    );
  });
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Ledgerly dashboard">
          <span className="brand-mark"><WalletCards size={21} /></span>
          <span>Ledgerly</span>
        </Link>
        <nav aria-label="Primary navigation"><NavItems /></nav>
        <div className="local-badge"><HardDrive size={16} /><span>Private on this Mac</span></div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><WalletCards size={19} /></span><strong>Ledgerly</strong></div>
          <div className="top-actions" aria-label="Common actions">
            <Link className="button ghost" href="/documents?drive=sync"><RefreshCw size={17} />Drive sync</Link>
            <Link className="button secondary" href="/documents?import=open"><Upload size={17} />Import</Link>
            <Link className="button primary" href="/transactions?add=open"><Plus size={18} />Add entry</Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation"><NavItems mobile /></nav>
    </div>
  );
}
