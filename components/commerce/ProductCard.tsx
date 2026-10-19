import Link from "next/link";
import { ProductImage } from "@/components/commerce/ProductImage";
import type { StorefrontProduct } from "@/lib/catalogue/storefront";
import { formatPrice } from "@/lib/format-price";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <Link href={product.href} aria-label={`${product.name}, ${formatPrice(product.price)}`} className="block min-w-0">
      <article>
        <ProductImage src={product.image} name={product.name} category={product.category}
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 44vw, 24vw" />
        <div className="mt-3 flex items-start justify-between gap-3 text-[12px] leading-5">
          <h3 className="text-foreground">{product.name}</h3>
          <p className="shrink-0 text-foreground/80">
            {formatPrice(product.price)}
          </p>
        </div>
      </article>
    </Link>
  );
}
