import "server-only";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db";

type Row = { merchant: string; categoryLabel: string; amountCents: number; date: string; tags: string };
const subscriptionHints = ["netflix","spotify","hulu","disney","youtube","icloud","dropbox","adobe","microsoft","amazon prime","patreon","membership","studio","gym","openai","chatgpt","canva","notion","zoom","slack","github"];
const recurringHints = ["mortgage","rent","loan","insurance","utility","utilities","electric","water","internet","phone","mobile","daycare","tuition","lease","car payment","auto payment","hoa","property tax"];
const windows = [{ cadence: "weekly", min: 5, max: 9 },{ cadence: "biweekly", min: 12, max: 17 },{ cadence: "monthly", min: 24, max: 40 },{ cadence: "quarterly", min: 75, max: 110 },{ cadence: "annual", min: 330, max: 400 }] as const;

export function normalizeMerchant(value: string) { return value.toLowerCase().trim().replace(/#\d+$/g, "").replace(/\d{6,}/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
const days = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
function nextDate(last: string, cadence: string) { const date = new Date(`${last}T12:00:00`); if (cadence === "weekly") date.setDate(date.getDate()+7); if (cadence === "biweekly") date.setDate(date.getDate()+14); if (cadence === "monthly") date.setMonth(date.getMonth()+1); if (cadence === "quarterly") date.setMonth(date.getMonth()+3); if (cadence === "annual") date.setFullYear(date.getFullYear()+1); return date.toLocaleDateString("en-CA"); }

export function detectRecurringPatterns() {
  const database = getDatabase();
  const rows = database.prepare(`SELECT t.merchant,t.categoryLabel,t.amountCents,t.date,COALESCE(group_concat(tag.name,' '),'') tags FROM transactions t LEFT JOIN transaction_tags tt ON tt.transactionId=t.id LEFT JOIN tags tag ON tag.id=tt.tagId WHERE t.type='expense' GROUP BY t.id ORDER BY t.date`).all() as Row[];
  const ignored = new Set((database.prepare("SELECT patternKey FROM dismissed_patterns").all() as Array<{patternKey:string}>).map((row)=>row.patternKey));
  const groups = new Map<string, Row[]>(); for (const row of rows) { const key=normalizeMerchant(row.merchant); if(key) groups.set(key,[...(groups.get(key)??[]),row]); }
  const suggestions=[];
  for (const [merchant, group] of groups) {
    const unique=[...new Map(group.map((row)=>[row.date,row])).values()]; if(unique.length<2) continue;
    const intervals=unique.slice(1).map((row,index)=>days(unique[index].date,row.date));
    const counts=windows.map((window)=>({...window,count:intervals.filter((value)=>value>=window.min&&value<=window.max).length})).sort((a,b)=>b.count-a.count);
    const dominant=counts[0]; if(!dominant.count || dominant.count<=intervals.length/2) continue;
    const context=`${merchant} ${group[0].categoryLabel} ${group[0].tags}`.toLowerCase();
    const subscription=subscriptionHints.some((hint)=>context.includes(hint)) || context.includes("subscription");
    const recurring=recurringHints.some((hint)=>context.includes(hint));
    const amounts=unique.map((row)=>row.amountCents); const average=amounts.reduce((a,b)=>a+b,0)/amounts.length; const variation=(Math.max(...amounts)-Math.min(...amounts))/average;
    let kind: "subscription"|"recurring"|null=subscription?"subscription":recurring?"recurring":null;
    if(!kind && unique.length>=3 && ["monthly","quarterly","annual"].includes(dominant.cadence) && variation<=.03) kind="recurring";
    if(!kind || variation>(kind==="subscription"?.2:.35)) continue;
    const sortedIntervals=[...intervals].sort((a,b)=>a-b); const median=sortedIntervals[Math.floor(sortedIntervals.length/2)]; const jitter=Math.max(...intervals.map((value)=>Math.abs(value-median)));
    const patternKey=crypto.createHash("sha256").update(`${merchant}|${dominant.cadence}|${kind}`).digest("hex"); if(ignored.has(patternKey)) continue;
    const factor=dominant.cadence==="weekly"?52/12:dominant.cadence==="biweekly"?26/12:dominant.cadence==="quarterly"?1/3:dominant.cadence==="annual"?1/12:1;
    suggestions.push({patternKey,kind,merchant:group.at(-1)!.merchant,category:group[0].categoryLabel,cadence:dominant.cadence,occurrences:unique.length,confidence:unique.length>=3&&variation<=.12&&jitter<=5?"High confidence":"Likely",averageCents:Math.round(average),monthlyCents:Math.round(average*factor),nextDate:nextDate(unique.at(-1)!.date,dominant.cadence)});
  }
  return suggestions;
}
