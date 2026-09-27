import { cn } from "@/lib/cn";
import { formatPrice, type Product } from "@/lib/mock-data";
import type { ProductDetailMock } from "@/lib/product-detail-mock";
import { ProductControls } from "@/components/product/ProductControls";

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

      <ProductControls
        productId={productId}
        sizes={sizes}
        availableSizes={product.sizes_available ?? []}
        sizeStock={product.size_stock ?? null}
        stockQty={product.stock_qty}
      />
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
