import { query } from "@/lib/query";
import { getStore } from "@/lib/store";
import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const code = params.get("code");

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing 'code' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore();
  const pageParam = params.get("page");
  const result = query(store, {
    code,
    type: params.get("type") ?? undefined,
    npi: params.get("npi") ?? undefined,
    ein: params.get("ein") ?? undefined,
    facility: params.get("facility") ?? undefined,
    page: pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
