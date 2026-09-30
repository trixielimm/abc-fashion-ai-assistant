"use client";

import { useEffect, useState } from "react";
import { clearPendingSave, readPendingSave } from "@/lib/style/pending";

export function PendingStyleAction() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const pending = readPendingSave();
    if (!pending || window.location.pathname === "/sign-in") return;
    let cancelled = false;
    async function resume() {
      if (!pending) return;
      let url: string;
      let body: object;
      if (pending.type === "product") {
        url = "/api/me/saved-products";
        body = { product_id: pending.product_id };
      } else if (pending.type === "memory") {
        url = "/api/me/style-memories";
        body = pending.memory;
      } else {
        url = "/api/me/style-profile";
        const profile = await fetch(url, { cache: "no-store" });
        if (!profile.ok) {
          if (!cancelled) setMessage("Your size could not be saved. Refresh to retry, or dismiss this action.");
          return;
        }
        const data = await profile.json();
        body = { sizes: [
          ...(data.profile?.sizes ?? []).filter((size: { item_type: string }) => size.item_type !== pending.item_type),
          { item_type: pending.item_type, size_system: pending.size_system, size_label: pending.size_label },
        ] };
      }
      const response = await fetch(url, {
        method: pending.type === "size" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (cancelled || response.status === 401) return;
      if (response.ok) {
        clearPendingSave();
        setMessage("Saved to My Style.");
        window.dispatchEvent(new Event("style-profile-updated"));
      } else {
        setMessage("Your style could not be saved. Refresh to retry, or dismiss this action.");
      }
    }
    void resume().catch(() => { if (!cancelled) setMessage("Your style could not be saved. Please try again."); });
    return () => { cancelled = true; };
  }, []);

  return message ? (
    <div role="status" className="fixed bottom-20 right-5 z-50 max-w-xs border border-hairline bg-background px-4 py-3 text-sm shadow-lg">
      {message}
      <button type="button" onClick={() => { clearPendingSave(); setMessage(""); }} className="ml-3 underline">Dismiss</button>
    </div>
  ) : null;
}
