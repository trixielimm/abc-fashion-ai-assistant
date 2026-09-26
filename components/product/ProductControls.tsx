"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function ProductControls({
  sizes,
  availableSizes,
  sizeStock,
  stockQty,
}: {
  sizes: string[];
  availableSizes: string[];
  sizeStock: Record<string, number> | null;
  stockQty: number | null;
}) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const hasSizes = sizes.length > 0;

  function getStock(size: string | null) {
    if (size) {
      const sizeQuantity = sizeStock?.[size];
      if (sizeQuantity !== undefined) return sizeQuantity;
      if (availableSizes.length > 0 && !availableSizes.includes(size)) return 0;
    }

    return stockQty;
  }

  const selectedStock = getStock(selectedSize);

  useEffect(() => {
    if (!feedback) return;

    const timeoutId = window.setTimeout(() => setFeedback(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  function showFeedback(message: string) {
    setFeedback(message);
  }

  function chooseSize(size: string) {
    const nextStock = getStock(size);
    setSelectedSize(size);
    setQuantity((current) =>
      nextStock === null ? current : Math.min(current, Math.max(1, nextStock)),
    );
    setFeedback("");
  }

  function addToBag() {
    if (hasSizes && !selectedSize) {
      showFeedback("Please select a size");
      return;
    }

    // TODO: Connect this action to the shared cart store when one is available.
    showFeedback("Added to bag");
  }

  return (
    <>
      {hasSizes ? (
        <div className="mt-7 w-full">
          <p
            className="mb-3 text-[12px] text-foreground"
            id="product-size-label"
          >
            Size{" "}
            <span className="text-muted">
              — {selectedSize ?? "Select a size"}
            </span>
          </p>
          <div
            className="flex flex-wrap gap-2"
            aria-labelledby="product-size-label"
          >
            {sizes.map((size) => {
              const available = getStock(size) !== 0;
              const selected = size === selectedSize;

              return (
                <button
                  key={size}
                  type="button"
                  disabled={!available}
                  aria-disabled={!available}
                  aria-pressed={selected}
                  aria-label={`${size}${available ? "" : ", out of stock"}`}
                  onClick={() => chooseSize(size)}
                  className={cn(
                    "flex h-10 min-w-11 items-center justify-center border px-3 text-[13px]",
                    !available &&
                      "cursor-not-allowed border-border bg-background text-muted line-through",
                    available &&
                      !selected &&
                      "border-border bg-background text-foreground",
                    available &&
                      selected &&
                      "border-foreground bg-foreground text-background",
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-7 flex w-full gap-3">
        <div
          className="flex h-11 shrink-0 items-center border border-border bg-background"
          aria-label={`Quantity: ${quantity}`}
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="flex h-full w-9 items-center justify-center text-[15px] text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            −
          </button>
          <span className="w-8 text-center text-[14px]" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={selectedStock !== null && quantity >= selectedStock}
            onClick={() =>
              setQuantity((current) =>
                selectedStock === null
                  ? current + 1
                  : Math.min(current + 1, selectedStock),
              )
            }
            className="flex h-full w-9 items-center justify-center text-[15px] text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
        <button
          type="button"
          disabled={selectedStock === 0}
          onClick={addToBag}
          className="flex h-11 flex-1 items-center justify-center gap-2 bg-foreground px-4 text-[13px] text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to Cart <span aria-hidden="true">→</span>
        </button>
      </div>
      <p
        className="mt-2 min-h-5 text-[12px] text-muted"
        role="status"
        aria-live="polite"
      >
        {feedback}
      </p>
    </>
  );
}
