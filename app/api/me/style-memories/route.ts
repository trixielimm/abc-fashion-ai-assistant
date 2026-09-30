import { z } from "zod";
import { MemorySchema } from "@/lib/style/schema";
import { addStyleMemory, authenticatedClient } from "@/lib/style/server";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to remember your style." }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = MemorySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid style memory." }, { status: 400, headers });
  try {
    const memory = await addStyleMemory(auth.supabase, auth.user.id, parsed.data);
    return Response.json({ memory }, { headers });
  } catch {
    return Response.json({ error: "Could not save this memory. Please try again." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to change your style." }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = z.object({ id: z.uuid() }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid memory ID." }, { status: 400, headers });
  const { error } = await auth.supabase.from("style_memories").delete().eq("user_id", auth.user.id).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Could not remove this memory." }, { status: 503, headers });
  return Response.json({ ok: true }, { headers });
}
