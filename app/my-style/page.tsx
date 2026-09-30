"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { createClient } from "@/lib/supabase/client";
import type { StyleMemory, StyleProfile, StyleSize } from "@/lib/style/schema";

type SavedItem = {
  product_id: string;
  created_at: string;
  product: { product_name: string | null; price_aud: number | null; colour: string | null } | null;
};

const emptyProfile: StyleProfile = { preferred_name: "", sizes: [], memories: [] };

export default function MyStylePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile>(emptyProfile);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"like" | "avoid" | "note">("like");
  const [facet, setFacet] = useState("style");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState("");

  const refresh = useCallback(async () => {
    const [profileResponse, savedResponse] = await Promise.all([
      fetch("/api/me/style-profile", { cache: "no-store" }),
      fetch("/api/me/saved-products", { cache: "no-store" }),
    ]);
    if (profileResponse.status === 401) {
      router.replace("/sign-in?next=%2Fmy-style");
      return;
    }
    if (!profileResponse.ok || !savedResponse.ok) throw new Error("Could not load your style.");
    const profileData = await profileResponse.json();
    const savedData = await savedResponse.json();
    setProfile(profileData.profile);
    setEmail(profileData.email ?? "");
    setSaved(savedData.items ?? []);
    setLoaded(true);
  }, [router]);

  useEffect(() => { void Promise.resolve().then(refresh).catch(() => { setLoaded(true); setMessage("Could not load your style. Please refresh."); }); }, [refresh]);
  useEffect(() => {
    const onUpdate = () => { void refresh().catch(() => setMessage("Could not refresh your style.")); };
    window.addEventListener("style-profile-updated", onUpdate);
    return () => window.removeEventListener("style-profile-updated", onUpdate);
  }, [refresh]);

  function updateSize(itemType: "dress" | "shoes", field: "size_system" | "size_label", text: string) {
    setProfile((current) => {
      const sizes = current.sizes.filter((size) => size.item_type !== itemType);
      const previous = current.sizes.find((size) => size.item_type === itemType) ?? { item_type: itemType, size_system: "AU", size_label: "" };
      sizes.push({ ...previous, [field]: text });
      return { ...current, sizes };
    });
  }

  async function saveBasics(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const sizes = profile.sizes.filter((size) => size.size_label.trim() && size.size_system.trim());
    try {
      const response = await fetch("/api/me/style-profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_name: profile.preferred_name, sizes }),
      });
      if (!response.ok) throw new Error("Save failed.");
      setProfile((await response.json()).profile);
      setMessage("Your name and sizes are saved.");
    } catch { setMessage("Could not save your name and sizes. Please try again."); }
  }

  async function addMemory(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await fetch("/api/me/style-memories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, facet: kind === "note" ? "note" : facet, value, item_scope: scope.trim() || null }),
      });
      if (!response.ok) throw new Error("Save failed.");
      setValue(""); setScope("");
      await refresh();
      setMessage("Added to your style.");
    } catch { setMessage("Could not save that memory. Please try again."); }
  }

  async function removeMemory(memory: StyleMemory) {
    const response = await fetch("/api/me/style-memories", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: memory.id }),
    });
    if (response.ok) { setProfile((current) => ({ ...current, memories: current.memories.filter((item) => item.id !== memory.id) })); setMessage("Memory removed."); }
    else setMessage("Could not remove that memory.");
  }

  async function removeProduct(productId: string) {
    const response = await fetch("/api/me/saved-products", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: productId }),
    });
    if (response.ok) { setSaved((current) => current.filter((item) => item.product_id !== productId)); setMessage("Saved item removed."); window.dispatchEvent(new Event("style-profile-updated")); }
    else setMessage("Could not remove that item.");
  }

  async function clearAll() {
    if (!window.confirm("Clear your name, sizes, memories and saved items?")) return;
    const response = await fetch("/api/me/style-profile", { method: "DELETE" });
    if (response.ok) { setProfile(emptyProfile); setSaved([]); setMessage("Your style data was cleared."); window.dispatchEvent(new Event("style-profile-updated")); }
    else setMessage("Could not clear all style data. Please try again.");
  }

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) { setMessage("Could not sign out. Please try again."); return; }
    sessionStorage.removeItem("abc-fashion-stylist-chat");
    window.location.assign(new URL("/", window.location.origin).toString());
  }

  if (!loaded) return <Container className="px-5 py-16">Loading your style…</Container>;

  return (
    <Container className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-widest text-muted">Your account</p><h1 className="mt-2 font-serif text-4xl">My Style</h1><p className="mt-2 text-sm text-muted">{email}</p></div>
        <button type="button" onClick={signOut} className="border border-border px-4 py-2 text-xs uppercase">Sign out</button>
      </div>
      {message ? <p role="status" className="mt-5 border border-hairline bg-surface p-3 text-sm">{message}</p> : null}

      <form onSubmit={saveBasics} className="mt-10 border-t border-border pt-8">
        <h2 className="font-serif text-2xl">Name & sizes</h2>
        <label className="mt-5 block text-sm">What should the stylist call you?
          <input value={profile.preferred_name} onChange={(event) => setProfile((current) => ({ ...current, preferred_name: event.target.value }))} maxLength={80} className="mt-2 h-11 w-full border border-border bg-background px-3" />
        </label>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(["dress", "shoes"] as const).map((itemType) => {
            const size: StyleSize = profile.sizes.find((item) => item.item_type === itemType) ?? { item_type: itemType, size_system: "AU", size_label: "" };
            return <div key={itemType}><p className="mb-2 text-sm capitalize">{itemType} size</p><div className="flex gap-2">
              <select aria-label={`${itemType} size system`} value={size.size_system} onChange={(event) => updateSize(itemType, "size_system", event.target.value)} className="h-11 border border-border bg-background px-2">
                {["AU", "UK", "EU", "US"].map((system) => <option key={system}>{system}</option>)}
              </select>
              <input aria-label={`${itemType} size`} value={size.size_label} onChange={(event) => updateSize(itemType, "size_label", event.target.value)} maxLength={30} placeholder="e.g. 10" className="h-11 min-w-0 flex-1 border border-border bg-background px-3" />
            </div></div>;
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Current unqualified catalogue sizes use AU labels. Other systems can be saved, but only match products explicitly labelled in that system. The stylist does not guess conversions.</p>
        <button className="mt-5 bg-foreground px-5 py-3 text-xs uppercase text-background">Save name & sizes</button>
      </form>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-serif text-2xl">What you like and avoid</h2>
        <p className="mt-2 text-sm text-muted">For example, avoid skinny fit for jeans or add a note that you prefer sleeves.</p>
        <form onSubmit={addMemory} className="mt-5 grid gap-3 sm:grid-cols-2">
          <select aria-label="Memory type" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="h-11 border border-border bg-background px-3"><option value="like">I like</option><option value="avoid">I avoid</option><option value="note">Personal note</option></select>
          {kind !== "note" ? <select aria-label="Preference type" value={facet} onChange={(event) => setFacet(event.target.value)} className="h-11 border border-border bg-background px-3">
            <option value="style">Style</option><option value="fit">Fit</option><option value="colour">Colour</option><option value="brand_line">Brand</option><option value="material">Material</option><option value="product_type">Product type</option><option value="tag">Detail</option>
          </select> : <span />}
          <input aria-label="Preference or note" required maxLength={240} value={value} onChange={(event) => setValue(event.target.value)} placeholder={kind === "note" ? "I prefer sleeves" : "e.g. skinny"} className="h-11 border border-border bg-background px-3" />
          <input aria-label="Applies to item type" maxLength={80} value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Optional: e.g. jeans" className="h-11 border border-border bg-background px-3" />
          <button className="bg-foreground px-5 py-3 text-xs uppercase text-background sm:col-span-2">Add to My Style</button>
        </form>
        <ul className="mt-6 divide-y divide-border">
          {profile.memories.map((memory) => <li key={memory.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span><strong className="capitalize">{memory.kind}</strong> {memory.value}{memory.item_scope ? ` · ${memory.item_scope}` : ""}</span><button type="button" onClick={() => removeMemory(memory)} className="shrink-0 underline">Remove</button></li>)}
          {!profile.memories.length ? <li className="py-3 text-sm text-muted">No memories saved yet.</li> : null}
        </ul>
      </section>

      <section className="mt-12 border-t border-border pt-8"><h2 className="font-serif text-2xl">Saved items</h2><ul className="mt-5 divide-y divide-border">
        {saved.map((item) => <li key={item.product_id} className="flex items-center justify-between gap-4 py-3 text-sm"><Link href={`/products/${encodeURIComponent(item.product_id)}`} className="underline">{item.product?.product_name ?? item.product_id}</Link><button type="button" onClick={() => removeProduct(item.product_id)} className="underline">Remove</button></li>)}
        {!saved.length ? <li className="py-3 text-sm text-muted">No saved items yet.</li> : null}
      </ul></section>
      <section className="mt-12 border-t border-border pt-8"><h2 className="font-serif text-2xl">Your data</h2><p className="mt-2 text-sm text-muted">Clearing My Style removes your saved name, sizes, likes, avoids, notes and items. It does not delete your sign-in account.</p><button type="button" onClick={clearAll} className="mt-5 border border-border px-5 py-3 text-xs uppercase">Clear my style data</button></section>
    </Container>
  );
}
