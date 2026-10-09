"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";

import {
  buildCrossSellRequest,
  readCrossSellResponse,
  type CrossSellCardProduct,
  type CrossSellReply,
} from "@/lib/search/crossSellClient";

type Props = {
  products: Array<{
    product_id: string;
    product_name: string;
  }>;
  preferences: ShoppingPreferences;
  renderProducts: (products: CrossSellCardProduct[]) => ReactNode;
};

export function CrossSellConversation({
  products,
  preferences,
  renderProducts,
}: Props) {
  const [open, setOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState("");
  const [budget, setBudget] = useState("");
  const [size, setSize] = useState("");
  const [needsSize, setNeedsSize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState<CrossSellReply | null>(null);
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
    setBudget("");
    setSize("");
    setNeedsSize(false);
    setLoading(false);
    setError("");
    setResult(null);
  }

  async function submit() {
    if (requestRef.current !== null) return;

    let request;

    try {
      request = buildCrossSellRequest(
        primaryId,
        budget,
        needsSize ? size : null,
        preferences
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Check the form."
      );
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;

    const timer = window.setTimeout(
      () => controller.abort(),
      45_000
    );

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/cross-sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Cross-sell request failed.");
      }

      const checked = readCrossSellResponse(
        await response.json(),
        request
      );

      if (
        requestRef.current !== controller ||
        controller.signal.aborted
      ) {
        return;
      }

      setResult(checked);

      if (checked.status === "needs_more_detail") {
        setNeedsSize(true);
      }
    } catch {
      if (requestRef.current !== controller) return;

      setError(
        controller.signal.aborted
          ? "The extra-item search timed out. Your main search is unchanged. Try again."
          : "Extra items could not be loaded or verified. Your main search is unchanged. Try again."
      );
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 border border-hairline px-3 py-2 text-[12px]"
      >
        Find an optional extra
      </button>
    );
  }

  return (
    <section className="mt-4 border-t border-hairline pt-4 text-[12px]">
      <p className="font-semibold">
        Would you like an additional item?
      </p>

      <p className="mt-1 text-muted">
        Choose a main product and a separate maximum price for each extra.
        This is not a combined outfit budget. Your main search stays unchanged.
      </p>

      <p className="mt-2 text-muted">
        From this request: colours{" "}
        {preferences.preferred_colours.join(", ") || "not specified"};
        excluded colours{" "}
        {preferences.excluded_colours.join(", ") || "none"};
        collection {preferences.gender ?? "not specified"};
        occasion {preferences.occasion ?? "not specified"};
        style {preferences.style ?? "not specified"}.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={loading} className="mt-3 space-y-3">
          <label className="block">
            Main product

            <select
              value={primaryId}
              disabled={needsSize}
              required
              onChange={(event) => {
                setPrimaryId(event.target.value);
                setResult(null);
                setError("");
              }}
              className="mt-1 h-10 w-full border border-hairline bg-background px-2"
            >
              <option value="">Choose a product</option>

              {products.map((product) => (
                <option
                  key={product.product_id}
                  value={product.product_id}
                >
                  {product.product_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            Maximum price per additional item (AUD)

            <input
              type="number"
              min="0"
              step="0.01"
              required
              disabled={needsSize}
              value={budget}
              onChange={(event) => {
                setBudget(event.target.value);
                setResult(null);
                setError("");
              }}
              placeholder="For example, 50"
              className="mt-1 h-10 w-full border border-hairline bg-background px-2"
            />
          </label>

          {needsSize ? (
            <label className="block">
              Size for the additional item

              <input
                value={size}
                required
                maxLength={100}
                onChange={(event) => {
                  setSize(event.target.value);
                  setResult(null);
                  setError("");
                }}
                placeholder="Use its own size, including One Size if applicable"
                className="mt-1 h-10 w-full border border-hairline bg-background px-2"
              />
            </label>
          ) : null}

          <button
            type="submit"
            className="border border-hairline px-3 py-2"
          >
            {loading
              ? "Searching..."
              : needsSize
                ? "Find extras / retry"
                : "Continue"}
          </button>
        </fieldset>
      </form>

      <button
        type="button"
        onClick={cancel}
        className="mt-2 underline"
      >
        Cancel extra search
      </button>

      {loading ? (
        <p role="status" className="mt-2">
          Checking the catalogue...
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3">
          <p role="status">{result.message}</p>

          {result.products.length > 0
            ? renderProducts(result.products)
            : null}
        </div>
      ) : null}
    </section>
  );
}