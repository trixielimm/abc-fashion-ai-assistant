import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { StyleProfile } from "./schema";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function authenticatedClient(): Promise<{ supabase: Client; user: User } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function loadStyleProfile(supabase: Client, user: User): Promise<StyleProfile> {
  const [profile, sizes, memories] = await Promise.all([
    supabase.from("style_profiles").select("preferred_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("style_sizes").select("item_type,size_system,size_label").eq("user_id", user.id),
    supabase.from("style_memories").select("id,kind,facet,value,item_scope,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (profile.error || sizes.error || memories.error) throw new Error("Style profile unavailable.");
  return {
    preferred_name: profile.data?.preferred_name ?? "",
    sizes: (sizes.data ?? []) as StyleProfile["sizes"],
    memories: (memories.data ?? []) as StyleProfile["memories"],
  };
}

export async function addStyleMemory(supabase: Client, userId: string, memory: {
  kind: string; facet: string; value: string; item_scope: string | null;
}) {
  const { data: possible, error: lookupError } = await supabase.from("style_memories")
    .select("id,kind,facet,value,item_scope,created_at").eq("user_id", userId)
    .eq("kind", memory.kind).eq("facet", memory.facet).limit(200);
  if (lookupError) throw new Error("Unable to check saved style.");
  const existing = possible?.find((item) => item.value.trim().toLowerCase() === memory.value.trim().toLowerCase() &&
    (item.item_scope ?? "").trim().toLowerCase() === (memory.item_scope ?? "").trim().toLowerCase());
  if (existing) return existing;
  const { data, error } = await supabase.from("style_memories")
    .insert({ user_id: userId, ...memory })
    .select("id,kind,facet,value,item_scope,created_at").single();
  if (error || !data) throw new Error("Unable to save style memory.");
  return data;
}
