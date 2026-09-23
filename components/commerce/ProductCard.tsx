import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/mock-data";
import { formatPrice } from "@/lib/mock-data";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={product.href} className="block min-w-0">
      <article>
        <div className="relative aspect-[3/4] overflow-hidden bg-surface">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 70vw, 22vw"
            className="object-cover"
          />
        </div>
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
