import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RecommendationEventSchema } from "@/lib/stylist/commerceSchema";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
const batchSchema = z.strictObject({ events: z.array(RecommendationEventSchema).min(1).max(8) });
const windows = new Map<string, { count: number; expires: number }>();
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  // Opt-in server configuration. No database writes when disabled.
  if (process.env.STYLIST_ANALYTICS_ENABLED !== "true") return new Response(null, { status: 204, headers });
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
  } catch { return Response.json({ error: "Origin not allowed." }, { status: 403, headers }); }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return new Response(null, { status: 415, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers });
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > 8192) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
    chunks.push(next.value);
  }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return new Response(null, { status: 400, headers }); }
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success || new Set(parsed.data.events.map(event => event.session_id)).size !== 1) return new Response(null, { status: 400, headers });
  const now = Date.now(), session = parsed.data.events[0].session_id;
  for (const [id, window] of windows) if (window.expires < now) windows.delete(id);
  const window = windows.get(session) ?? { count: 0, expires: now + 60_000 };
  window.count += parsed.data.events.length;
  if (window.count > 60 || windows.size > 5000) return new Response(null, { status: 429, headers });
  windows.set(session, window);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return new Response(null, { status: 503, headers });
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("stylist_recommendation_events")
    .upsert(parsed.data.events, { onConflict: "event_id", ignoreDuplicates: true })
    .abortSignal(AbortSignal.timeout(5000));
  return new Response(null, { status: error ? 503 : 204, headers });
}
