import { getState } from "@/lib/queries";
import { DocumentsClient } from "@/components/documents-client";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const state = getState();
  return <DocumentsClient initialDocuments={JSON.parse(JSON.stringify(state.documents))} />;
}
