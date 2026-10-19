import Image from "next/image";
import Link from "next/link";
import { featuredProducts } from "@/lib/mock-data";
import { formatPrice } from "@/lib/format-price";

export function RelatedProducts({
  currentProductId,
}: {
  currentProductId: string;
}) {
  const products = featuredProducts
    .filter((product) => product.id !== currentProductId)
    .slice(0, 4);

  return (
    <section className="pt-14 lg:pt-16">
      <h2 className="mb-5 text-[12px] tracking-[0.08em] text-muted uppercase">
        You May Also Like
      </h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {products.map((product) => (
          <Link
            key={product.id}
            href={product.href}
            className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4"
          >
            <div className="relative aspect-square overflow-hidden bg-surface">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="96px"
                className="object-cover transition-opacity group-hover:opacity-80"
              />
            </div>
            <p className="text-[13px] leading-5 text-muted">
              <span className="font-medium text-foreground">
                {product.name}
              </span>
              <br />
              {formatPrice(product.price)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
