import { getState } from "@/lib/queries";
import { TransactionsClient } from "@/components/transactions-client";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const state = getState();
  return <TransactionsClient initialState={JSON.parse(JSON.stringify(state))} />;
}
