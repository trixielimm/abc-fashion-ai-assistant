"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import {
  buildUpsellRequest,
  readUpsellResponse,
  type UpsellPrimary,
  type UpsellOption,
  type UpsellReply,
} from "@/lib/search/upsellClient";

type Props = {
  products: UpsellPrimary[];
  preferences: ShoppingPreferences;
  renderProduct: (product: UpsellOption) => ReactNode;
};

export function UpsellComparison({ products, preferences, renderProduct }: Props) {
  const [open, setOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<UpsellReply | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  function cancel() {
    requestRef.current?.abort();
    requestRef.current = null;
    setOpen(false);
    setPrimaryId("");
    setLoading(false);
    setError("");
    setReply(null);
  }

  async function compare() {
    if (requestRef.current !== null) return;

    const primary = products.find((product) => product.product_id === primaryId);
    if (!primary) {
      setError("Choose one of the main products first.");
      return;
    }

    let request;
    try {
      request = buildUpsellRequest(primaryId, preferences);
    } catch {
      setError("Check your size and price range in the main chat, then compare from the new results.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 45_000);
    setLoading(true);
    setError("");
    setReply(null);

    try {
      const response = await fetch("/api/upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Comparison request failed.");

      const result = readUpsellResponse(await response.json(), request, primary);
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setReply(result);
    } catch {
      if (requestRef.current !== controller) return;
      setError(controller.signal.aborted
        ? "Comparison timed out. Your preferences and cart are unchanged. Try again."
        : "Replacement options could not be loaded or verified. Try again or refresh the main search.");
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-4 border border-hairline px-3 py-2 text-[12px]">
        Compare higher-priced alternatives
      </button>
    );
  }

  return (
    <section className="mt-4 border-t border-hairline pt-4 text-[12px]">
      <p className="font-semibold">Optional replacement comparison</p>
      <p className="mt-1 text-muted">
        Same product type. Existing size: {preferences.size ?? "not supplied"}.
        Maximum per replacement: {preferences.max_price === null
          ? "not supplied"
          : `A$${preferences.max_price.toFixed(2)}`}.
        A higher price alone is not a reason to recommend an item.
      </p>
      <p className="mt-2 text-muted">
        Nothing changes automatically. Adding an alternative to your cart
        will not remove the original item. Use the main chat to change your budget.
      </p>

      <form onSubmit={(event) => { event.preventDefault(); void compare(); }}>
        <fieldset disabled={loading} className="mt-3 space-y-3">
          <label className="block">
            Which product would you like to compare?
            <select value={primaryId} required
              onChange={(event) => {
                setPrimaryId(event.target.value);
                setReply(null);
                setError("");
              }}
              className="mt-1 h-10 w-full border border-hairline bg-background px-2">
              <option value="">Choose a product</option>
              {products.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="border border-hairline px-3 py-2">
            {loading ? "Comparing..." : "Compare / retry"}
          </button>
        </fieldset>
      </form>

      <button type="button" onClick={cancel} className="mt-2 underline">
        Cancel comparison
      </button>
      {loading ? <p role="status" className="mt-2">Checking catalogue replacements...</p> : null}
      {error ? <p role="alert" className="mt-2">{error}</p> : null}

      {reply ? (
        <div className="mt-3">
          <p role="status">{reply.message}</p>
          {reply.primary_price_aud !== null ? (
            <p className="mt-1 text-muted">
              Current catalogue price of main item: A${reply.primary_price_aud.toFixed(2)}.
            </p>
          ) : null}
          <div className="mt-3 grid gap-4">
            {reply.products.map((product) => (
              <div key={product.product_id}>
                {renderProduct(product)}
                <p className="mt-2 leading-5">{product.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}