import { cn } from "@/lib/cn";
import { formatPrice, type Product } from "@/lib/mock-data";
import type { ProductDetailMock } from "@/lib/product-detail-mock";

const colourSwatches: Record<string, string> = {
  black: "bg-black",
  blue: "bg-blue-700",
  charcoal: "bg-neutral-700",
  ivory: "bg-stone-100",
  onyx: "bg-neutral-950",
  silver: "bg-zinc-300",
};

export function ProductInfo({
  product,
  listingProduct,
  productName,
  productId,
}: {
  product: ProductDetailMock;
  listingProduct?: Product;
  productName: string;
  productId: string;
}) {
  const sizes =
    product.size_stock && Object.keys(product.size_stock).length > 0
      ? Object.keys(product.size_stock)
      : (product.sizes_available ?? []);
  const selectedSize = sizes.find((size) => {
    const stock = product.size_stock?.[size];
    return stock === undefined ? true : stock > 0;
  });
  const swatchClass = product.colour
    ? (colourSwatches[product.colour.toLowerCase()] ?? "bg-surface")
    : undefined;

  return (
    <section className="flex flex-col items-start pt-1">
      {product.category ? (
        <p className="mb-2 text-[11px] tracking-[0.08em] text-muted uppercase">
          {product.category}
        </p>
      ) : null}
      <h1 className="font-serif text-[26px] font-semibold leading-tight text-foreground">
        {productName}
      </h1>
      <p className="mt-2 text-[17px] text-foreground">
        {formatPrice(listingProduct?.price ?? product.price_aud ?? 0)}
      </p>

      {product.colour ? (
        <div className="mt-7">
          <p className="mb-3 text-[12px] text-foreground">
            Colour <span className="text-muted">— {product.colour}</span>
          </p>
          <span
            aria-label={product.colour}
            className={cn(
              "block size-[30px] rounded-full border border-border ring-1 ring-foreground ring-offset-2 ring-offset-panel",
              swatchClass,
            )}
          />
        </div>
      ) : null}

      {sizes.length > 0 ? (
        <div className="mt-7 w-full">
          <p className="mb-3 text-[12px] text-foreground">
            Size <span className="text-muted">— Select a size</span>
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Available sizes">
            {sizes.map((size) => {
              const stock = product.size_stock?.[size];
              const available =
                stock === undefined
                  ? (product.sizes_available?.includes(size) ?? true)
                  : stock > 0;
              const selected = size === selectedSize;

              return (
                <span
                  key={size}
                  aria-label={`${size}${available ? "" : ", out of stock"}`}
                  className={cn(
                    "flex h-10 min-w-11 items-center justify-center border px-3 text-[13px]",
                    !available &&
                      "border-border bg-background text-muted line-through",
                    available &&
                      !selected &&
                      "border-border bg-background text-foreground",
                    available &&
                      selected &&
                      "border-foreground bg-foreground text-background",
                  )}
                >
                  {size}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-7 flex w-full gap-3">
        <div className="flex h-11 shrink-0 items-center border border-border bg-background">
          <span
            aria-hidden="true"
            className="flex w-9 justify-center text-[15px] text-muted"
          >
            −
          </span>
          <span className="w-8 text-center text-[14px]">1</span>
          <span
            aria-hidden="true"
            className="flex w-9 justify-center text-[15px] text-muted"
          >
            +
          </span>
        </div>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center gap-2 bg-foreground px-4 text-[13px] text-background transition-opacity hover:opacity-80"
        >
          Add to Cart <span aria-hidden="true">→</span>
        </button>
      </div>
      <button
        type="button"
        className="mt-3 h-11 w-full border border-border bg-transparent text-[12px] tracking-[0.05em] text-foreground uppercase"
      >
        <span aria-hidden="true" className="mr-2">
          ＋
        </span>
        Add to Wishlist
      </button>

      {product.description ? (
        <p className="mt-7 w-full border-t border-border pt-5 text-[13px] leading-[1.6] text-muted">
          {product.description}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-muted">Product ID: {productId}</p>
    </section>
  );
}
