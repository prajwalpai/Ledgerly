import "server-only";

import { NextRequest } from "next/server";

const allowedHosts = new Set(["127.0.0.1:4317", "localhost:4317"]);

export function assertLocalRequest(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  if (!host || !allowedHosts.has(host)) {
    throw new Error("LOCAL_REQUEST_REQUIRED");
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && origin !== `http://${host}`) {
      throw new Error("INVALID_ORIGIN");
    }
  }
}

export function safeApiError(error: unknown) {
  if (error instanceof Error && error.message === "LOCAL_REQUEST_REQUIRED") {
    return { status: 403, message: "Ledgerly is available only from this Mac." };
  }
  if (error instanceof Error && error.message === "INVALID_ORIGIN") {
    return { status: 403, message: "This request did not originate from Ledgerly." };
  }
  return { status: 500, message: "Ledgerly could not complete the request." };
}
