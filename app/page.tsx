import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, Landmark, PiggyBank, Sparkles } from "lucide-react";
import { getDashboardSummary } from "@/lib/queries";
import { PeriodSelect } from "@/components/period-select";

export const dynamic = "force-dynamic";

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function DashboardPage() {
  const summary = getDashboardSummary();
  const netWorth = summary.assetsCents - summary.liabilitiesCents;

  return (
    <div className="page dashboard-page">
      <section className="page-heading">
        <div><p className="eyebrow">Financial overview</p><h1>Your money, clearly.</h1><p>One private view of your financial life, stored only on this Mac.</p></div>
        <PeriodSelect value={summary.period} />
      </section>

      <section className="summary-grid" aria-label="Financial summary">
        <article className="summary-card navy"><div className="card-icon"><Landmark size={19} /></div><p>Net Worth</p><strong>{summary.netWorthConfigured ? formatMoney(netWorth) : "Not set"}</strong><div className="calculation-strip">{summary.netWorthConfigured ? "Assets minus liabilities" : <Link href="/settings">Set assets and liabilities <ArrowUpRight size={14} /></Link>}</div></article>
        <article className="summary-card"><div className="card-icon violet"><CircleDollarSign size={19} /></div><p>Income</p><strong>{formatMoney(summary.incomeCents)}</strong><div className="calculation-strip">No trend yet</div></article>
        <article className="summary-card"><div className="card-icon orange"><ArrowUpRight size={19} /></div><p>Spending</p><strong>{formatMoney(summary.spendingCents)}</strong><div className="calculation-strip">No trend yet</div></article>
        <article className="summary-card"><div className="card-icon green"><PiggyBank size={19} /></div><p>Savings rate</p><strong>{summary.savingsRate.toFixed(0)}%</strong><div className="calculation-strip">Income minus spending</div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel cash-flow"><div className="panel-heading"><div><p className="eyebrow">Overview</p><h2>Cash flow</h2></div></div><div className="empty-chart"><div className="empty-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div><h3>Your cash flow will appear here</h3><p>Import or add transactions to see cash flow.</p></div></article>
        <article className="panel category-panel"><div className="panel-heading"><div><p className="eyebrow">Breakdown</p><h2>Spending by category</h2></div></div><div className="donut-empty" aria-hidden="true" /><h3>No spending yet</h3><p>Categories will appear after your first expense.</p></article>
        <article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Latest</p><h2>Recent activity</h2></div><Link href="/transactions">View all</Link></div><div className="empty-list"><CircleDollarSign size={24} /><h3>No transactions yet</h3><p>Add an entry or import a statement to begin.</p></div></article>
        <article className="panel insight-panel"><div className="insight-icon"><Sparkles size={20} /></div><div><p className="eyebrow">Ledgerly insight</p><h2>A clean start</h2><p>There are no transactions needing review. Ledgerly will surface factual insights as your history grows.</p></div></article>
        <article className="panel coming-panel"><div className="panel-heading"><div><p className="eyebrow">Planning</p><h2>Coming up</h2></div></div><div className="empty-list compact"><PiggyBank size={22} /><h3>Nothing scheduled</h3><p>Confirmed recurring payments and subscriptions will appear here.</p><Link href="/recurring">Go to Recurring</Link></div></article>
      </section>
    </div>
  );
}
