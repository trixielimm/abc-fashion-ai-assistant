import { ProfileUpdateSchema } from "@/lib/style/schema";
import { authenticatedClient, loadStyleProfile } from "@/lib/style/server";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to view your style." }, { status: 401, headers });
  try {
    return Response.json({ profile: await loadStyleProfile(auth.supabase, auth.user), email: auth.user.email }, { headers });
  } catch {
    return Response.json({ error: "Could not load your style." }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to save your style." }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Check your name and sizes." }, { status: 400, headers });
  try {
    if (parsed.data.preferred_name !== undefined) {
      const { error } = await auth.supabase.from("style_profiles").upsert({
        user_id: auth.user.id, preferred_name: parsed.data.preferred_name,
      });
      if (error) throw error;
    }
    if (parsed.data.sizes !== undefined) {
      for (const itemType of ["dress", "shoes"] as const) {
        const size = parsed.data.sizes.find((item) => item.item_type === itemType);
        const result = size
          ? await auth.supabase.from("style_sizes").upsert({ user_id: auth.user.id, ...size })
          : await auth.supabase.from("style_sizes").delete().eq("user_id", auth.user.id).eq("item_type", itemType);
        if (result.error) throw result.error;
      }
    }
    return Response.json({ profile: await loadStyleProfile(auth.supabase, auth.user) }, { headers });
  } catch {
    return Response.json({ error: "Could not save your style. Please try again." }, { status: 503, headers });
  }
}

export async function DELETE() {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to clear your style." }, { status: 401, headers });
  for (const table of ["style_memories", "style_sizes", "saved_products", "style_profiles"] as const) {
    const { error } = await auth.supabase.from(table).delete().eq("user_id", auth.user.id);
    if (error) return Response.json({ error: "Could not clear all style data. Please try again." }, { status: 503, headers });
  }
  return Response.json({ ok: true }, { headers });
}
