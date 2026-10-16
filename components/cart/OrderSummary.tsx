import { formatPrice } from "@/lib/mock-data";

type OrderSummaryProps = {
  subtotal: number;
  count: number;
};

// Shows the cart total and checkout availability.
export function OrderSummary({
  subtotal,
  count,
}: OrderSummaryProps) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="border border-border bg-white px-6 py-7">
        <h2 className="font-serif text-[24px] leading-none">
          Order Summary
        </h2>

        <div className="mt-8 space-y-4 text-[12px]">
          <div className="flex items-center justify-between gap-4">
            <span className="uppercase">
              Item(s) subtotal ({count})
            </span>
            <span>{formatPrice(subtotal)} AUD</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="uppercase">Shipping</span>
            <span className="text-green-700">FREE</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5 text-[12px] font-semibold uppercase">
          <span>Order total</span>
          <span>{formatPrice(subtotal)} AUD</span>
        </div>
      </div>

      <button
        type="button"
        disabled
        title="Checkout is not available yet"
        className="mt-5 flex h-12 w-full items-center justify-center bg-black px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed"
      >
        Checkout coming soon
      </button>
    </aside>
  );
}
