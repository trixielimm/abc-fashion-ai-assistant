import Link from "next/link";
import { ProductImage } from "@/components/commerce/ProductImage";
import { formatPrice } from "@/lib/mock-data";
import type { CartRow } from "@/lib/cart";

type CartItemProps = {
  row: CartRow;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

// Displays a cart item and uses parent callbacks to update its quantity or remove it.
export function CartItem({
  row,
  onQuantityChange,
  onRemove,
}: CartItemProps) {
  return (
    <article className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 border-b border-border py-7 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-8">
      <Link
        href={row.href}
        aria-label={`View ${row.name}`}
        className="relative aspect-[3/4] self-start bg-surface"
      >
        <ProductImage
          src={row.image}
          name={row.name}
          category={row.category ?? null}
          sizes="(max-width: 640px) 100px, 150px"
        />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <Link
              href={row.href}
              className="font-serif text-xl leading-tight sm:text-2xl"
            >
              {row.name}
            </Link>

            <p className="mt-2 text-xs uppercase tracking-wide text-muted">
              Size: {row.size}
            </p>

            <p className="mt-2 text-sm font-medium">
              {formatPrice(row.price)} AUD
            </p>

            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-600"
                aria-hidden="true"
              />
              In Stock
            </p>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${row.name} from bag`}
            className="min-h-11 shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted underline underline-offset-4 hover:text-foreground"
          >
            Remove
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 sm:mt-7 sm:pt-5">
          <div
            className="flex h-11 shrink-0 items-center border border-border"
            aria-label={`Quantity for ${row.name}`}
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${row.name}`}
              disabled={row.quantity <= 1}
              onClick={() =>
                onQuantityChange(row.quantity - 1)
              }
              className="h-full w-11 disabled:text-neutral-300"
            >
              −
            </button>

            <span className="w-8 text-center text-xs" aria-live="polite">
              {row.quantity}
            </span>

            <button
              type="button"
              aria-label={`Increase quantity of ${row.name}`}
              onClick={() =>
                onQuantityChange(row.quantity + 1)
              }
              className="h-full w-11"
            >
              +
            </button>
          </div>

          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-widest text-muted">
              Subtotal
            </span>
            <span className="mt-1 block text-sm font-medium">
              {formatPrice(row.price * row.quantity)} AUD
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
