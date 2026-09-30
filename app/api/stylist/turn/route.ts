import { z } from "zod";
import { parseStylistTurn, RecentTurnSchema } from "@/lib/ai/parseStylistTurn";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { searchByPreferences } from "@/lib/search/preferenceSearch";
import { MemorySchema, SizeSchema, type StyleMemoryInput } from "@/lib/style/schema";
import { addStyleMemory, authenticatedClient, loadStyleProfile } from "@/lib/style/server";

export const runtime = "nodejs";

const RequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  recent_turns: z.array(RecentTurnSchema).max(6).default([]),
});
const headers = { "Cache-Control": "no-store" };

type Candidate = {
  kind: "size" | "like" | "avoid" | "note";
  facet: string | null;
  value: string;
  item_scope: string | null;
  item_type: "dress" | "shoes" | null;
  size_system: string | null;
};

function checkedCandidate(candidate: Candidate):
  | { type: "memory"; memory: StyleMemoryInput }
  | { type: "size"; size: z.infer<typeof SizeSchema> }
  | null {
  if (candidate.kind === "size") {
    const size = SizeSchema.safeParse({
      item_type: candidate.item_type,
      size_system: candidate.size_system,
      size_label: candidate.value,
    });
    return size.success ? { type: "size", size: size.data } : null;
  }
  const memory = MemorySchema.safeParse({
    kind: candidate.kind, facet: candidate.facet,
    value: candidate.value, item_scope: candidate.item_scope,
  });
  return memory.success ? { type: "memory", memory: memory.data } : null;
}

function sameMemory(a: StyleMemoryInput, b: StyleMemoryInput) {
  const norm = (text: string | null) => (text ?? "").trim().toLowerCase();
  return a.kind === b.kind && a.facet === b.facet && norm(a.value) === norm(b.value) && norm(a.item_scope) === norm(b.item_scope);
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json({ error: "Send a JSON shopping message." }, { status: 415, headers });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please check the shopping message." }, { status: 400, headers });

  try {
    const auth = await authenticatedClient();
    let profile = auth ? await loadStyleProfile(auth.supabase, auth.user) : null;
    const turn = await parseStylistTurn(parsed.data.message, parsed.data.recent_turns);
    const candidates = turn.candidates.map(checkedCandidate).filter((candidate) => candidate !== null);
    const saved: string[] = [];
    let pending_memory: (typeof candidates)[number] | null = null;
    let responseText = "";

    if (turn.action === "recall") {
      responseText = profile
        ? profile.memories.length || profile.sizes.length
          ? `I remember ${[
              ...profile.sizes.map((size) => `your ${size.item_type} size is ${size.size_system} ${size.size_label}`),
              ...profile.memories.map((memory) => `${memory.kind === "avoid" ? "you avoid" : memory.kind === "like" ? "you like" : "you noted"} ${memory.value}`),
            ].join("; ")}. You can edit these in My Style.`
          : "I don't have any saved style details yet. You can tell me what to remember."
        : "Sign in to see your saved style. Guest conversations are not saved.";
    }

    if (turn.action === "save" && candidates.length) {
      if (!auth) {
        pending_memory = candidates[0];
        responseText = "Sign in to save that to My Style. I won't say it's remembered until it has been saved.";
      } else {
        for (const candidate of candidates) {
          if (candidate.type === "memory") {
            await addStyleMemory(auth.supabase, auth.user.id, candidate.memory);
            saved.push(candidate.memory.value);
          } else {
            const { error } = await auth.supabase.from("style_sizes").upsert({ user_id: auth.user.id, ...candidate.size });
            if (error) throw error;
            saved.push(`${candidate.size.size_system} ${candidate.size.size_label} ${candidate.size.item_type} size`);
          }
        }
        responseText = `I'll remember ${saved.join(" and ")}. You can edit this in My Style.`;
        profile = await loadStyleProfile(auth.supabase, auth.user);
      }
    } else if (turn.action === "save") {
      responseText = "Tell me the exact style preference and, for sizes, the item type and sizing system you'd like me to remember.";
    }

    if (turn.action === "forget") {
      if (!auth) responseText = "Sign in to change your saved style.";
      else if (!candidates.length) responseText = "Tell me which saved size or style preference to forget.";
      else {
        let removed = 0;
        for (const candidate of candidates) {
          if (candidate.type === "size") {
            const { error, count } = await auth.supabase.from("style_sizes").delete({ count: "exact" })
              .eq("user_id", auth.user.id).eq("item_type", candidate.size.item_type)
              .eq("size_system", candidate.size.size_system).eq("size_label", candidate.size.size_label);
            if (error) throw error;
            removed += count ?? 0;
          } else {
            const matches = profile?.memories.filter((memory) => sameMemory(memory, candidate.memory)) ?? [];
            for (const memory of matches) {
              const { error } = await auth.supabase.from("style_memories").delete().eq("user_id", auth.user.id).eq("id", memory.id);
              if (error) throw error;
              removed++;
            }
          }
        }
        responseText = removed ? "I removed that from My Style." : "I couldn't find that saved memory. Check My Style to see what I have saved.";
      }
    }

    if (turn.action === "none" && candidates.length) pending_memory = candidates[0];
    if (turn.action === "none" && candidates.length && !turn.search_requested) responseText = "Thanks for telling me. If you want, you can save that to My Style for next time.";
    if (!turn.search_requested) {
      return Response.json({ message: responseText || "What would you like to shop for?", products: [], preferences: turn.preferences,
        applied_memories: [], pending_memory, saved, preferred_name: profile?.preferred_name ?? "" }, { headers });
    }

    const catalogue = await getCatalogueProducts();
    const result = searchByPreferences(catalogue, turn.preferences, profile);
    return Response.json({ message: [responseText, result.message].filter(Boolean).join(" "), products: result.products,
      preferences: turn.preferences, applied_memories: result.applied_memories ?? [], pending_memory, saved,
      preferred_name: profile?.preferred_name ?? "" }, { headers });
  } catch (error) {
    console.error("Stylist turn failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "The stylist could not complete that request. Nothing new was confirmed as saved. Please try again." }, { status: 503, headers });
  }
}
