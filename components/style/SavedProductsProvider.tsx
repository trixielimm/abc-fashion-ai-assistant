"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type SavedProductsState = {
  ids: Set<string>;
  ready: boolean;
  refresh: () => Promise<void>;
};

const Context = createContext<SavedProductsState | null>(null);

export function SavedProductsProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/me/saved-products", { cache: "no-store" });
    if (response.status === 401) { setIds(new Set()); setReady(true); return; }
    if (!response.ok) { setReady(true); return; }
    const data = await response.json();
    setIds(new Set((data.items ?? []).map((item: { product_id: string }) => item.product_id)));
    setReady(true);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => setReady(true));
    const onUpdate = () => { void refresh().catch(() => setReady(true)); };
    window.addEventListener("style-profile-updated", onUpdate);
    return () => window.removeEventListener("style-profile-updated", onUpdate);
  }, [refresh]);

  return <Context.Provider value={{ ids, ready, refresh }}>{children}</Context.Provider>;
}

export function useSavedProducts() {
  const context = useContext(Context);
  if (!context) throw new Error("useSavedProducts requires SavedProductsProvider");
  return context;
}
