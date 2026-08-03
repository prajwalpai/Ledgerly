import Link from "next/link";
import { ArrowUpRight, IndianRupee, Landmark, PiggyBank, Sparkles } from "lucide-react";
import { getDashboardSummary } from "@/lib/queries";
import { PeriodSelect } from "@/components/period-select";

export const dynamic = "force-dynamic";

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(cents / 100);

export default function DashboardPage() {
  const summary = getDashboardSummary();
  const netWorth = summary.assetsCents - summary.liabilitiesCents;
  const maxFlow = Math.max(1,...summary.monthly.flatMap((row)=>[Number((row as {incomeCents:number}).incomeCents),Number((row as {spendingCents:number}).spendingCents)]));
  const totalCategories=summary.categories.reduce<number>((sum,row)=>sum+Number((row as {amountCents:number}).amountCents),0);

  return (
    <div className="page dashboard-page">
      <section className="page-heading">
        <div><p className="eyebrow">Financial overview</p><h1>Your money, clearly.</h1><p>One private view of your financial life, stored only on this Mac.</p></div>
        <PeriodSelect value={summary.period} />
      </section>

      <section className="summary-grid" aria-label="Financial summary">
        <article className="summary-card navy"><div className="card-icon"><Landmark size={19} /></div><p>Net Worth</p><strong>{summary.netWorthConfigured ? formatMoney(netWorth) : "Not set"}</strong><div className="calculation-strip">{summary.netWorthConfigured ? "Assets minus liabilities" : <Link href="/settings">Set assets and liabilities <ArrowUpRight size={14} /></Link>}</div></article>
        <article className="summary-card"><div className="card-icon violet"><IndianRupee size={19} /></div><p>Income</p><strong>{formatMoney(summary.incomeCents)}</strong><div className="calculation-strip">No trend yet</div></article>
        <article className="summary-card"><div className="card-icon orange"><ArrowUpRight size={19} /></div><p>Spending</p><strong>{formatMoney(summary.spendingCents)}</strong><div className="calculation-strip">No trend yet</div></article>
        <article className="summary-card"><div className="card-icon green"><PiggyBank size={19} /></div><p>Savings rate</p><strong>{summary.savingsRate.toFixed(0)}%</strong><div className="calculation-strip">Income minus spending</div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel cash-flow"><div className="panel-heading"><div><p className="eyebrow">Overview</p><h2>Cash flow</h2></div></div>{summary.monthly.length?<div className="flow-chart">{summary.monthly.map((raw)=>{const row=raw as {month:string;incomeCents:number;spendingCents:number};return <div key={row.month}><div><i className="income-bar" style={{height:`${Math.max(3,row.incomeCents/maxFlow*100)}%`}}/><i className="spend-bar" style={{height:`${Math.max(3,row.spendingCents/maxFlow*100)}%`}}/></div><span>{row.month.slice(5)}</span></div>})}</div>:<div className="empty-chart"><h3>Your cash flow will appear here</h3><p>Import or add transactions to see cash flow.</p></div>}</article>
        <article className="panel category-panel"><div className="panel-heading"><div><p className="eyebrow">Breakdown</p><h2>Spending by category</h2></div></div>{summary.categories.length?<div className="category-breakdown">{summary.categories.map((raw)=>{const row=raw as {categoryLabel:string;amountCents:number};return <div key={row.categoryLabel}><span>{row.categoryLabel}</span><strong>{formatMoney(row.amountCents)}</strong><i><b style={{width:`${row.amountCents/totalCategories*100}%`}}/></i></div>})}</div>:<><div className="donut-empty" aria-hidden="true" /><h3>No spending yet</h3><p>Categories will appear after your first expense.</p></>}</article>
        <article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Latest</p><h2>Recent activity</h2></div><Link href="/transactions">View all</Link></div>{summary.recent.length?<div className="recent-list">{summary.recent.map((raw)=>{const row=raw as {id:string;merchant:string;date:string;amountCents:number;type:string};return <div key={row.id}><span><strong>{row.merchant}</strong><small>{row.date}</small></span><b>{row.type==='income'?'+':'−'}{formatMoney(row.amountCents)}</b></div>})}</div>:<div className="empty-list"><IndianRupee size={24} /><h3>No transactions yet</h3><p>Add an entry or import a statement to begin.</p></div>}</article>
        <article className="panel insight-panel"><div className="insight-icon"><Sparkles size={20} /></div><div><p className="eyebrow">Ledgerly insight</p><h2>{summary.needsReviewCount?`${summary.needsReviewCount} need review`:'Everything is categorized'}</h2><p>{summary.needsReviewCount?'Review uncategorized transactions to keep reports accurate.':'There are no transactions currently marked Needs review.'}</p></div></article>
        <article className="panel coming-panel"><div className="panel-heading"><div><p className="eyebrow">Planning</p><h2>Coming up</h2></div></div>{summary.upcoming.length?<div className="recent-list">{summary.upcoming.map((raw,index)=>{const row=raw as {name:string;nextDate:string;amountCents:number};return <div key={`${row.name}-${index}`}><span><strong>{row.name}</strong><small>{row.nextDate}</small></span><b>{formatMoney(row.amountCents)}</b></div>})}</div>:<div className="empty-list compact"><PiggyBank size={22} /><h3>Nothing scheduled</h3><p>Confirmed recurring payments and subscriptions will appear here.</p><Link href="/recurring">Go to Recurring</Link></div>}</article>
      </section>
    </div>
  );
}
