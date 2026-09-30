"use client";

import { useState } from "react";
import { signInForSave } from "@/lib/style/pending";
import { useSavedProducts } from "./SavedProductsProvider";

export function SaveProductButton({ productId, className = "" }: { productId: string; className?: string }) {
  const [saved, setSaved] = useState(false);
  const { ids, ready } = useSavedProducts();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (saved || ids.has(productId) || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/me/saved-products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (response.status === 401) { signInForSave({ type: "product", product_id: productId }); return; }
      if (!response.ok) throw new Error("Save failed.");
      setSaved(true);
      setMessage("Saved to My Style.");
      window.dispatchEvent(new Event("style-profile-updated"));
    } catch { setMessage("Could not save this product. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className={className}>
      <button type="button" disabled={busy || saved || ids.has(productId)} onClick={save} className="h-11 w-full border border-border bg-transparent px-3 text-[12px] tracking-[0.05em] uppercase disabled:opacity-60">
        {saved || (ready && ids.has(productId)) ? "Saved to My Style" : "＋ Save item"}
      </button>
      {message ? <p role="status" className="mt-1 text-xs text-muted">{message}</p> : null}
    </div>
  );
}
