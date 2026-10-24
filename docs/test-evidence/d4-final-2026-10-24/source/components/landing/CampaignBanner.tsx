import { ProductImage } from "@/components/commerce/ProductImage";
import { Button } from "@/components/ui/Button";
import type { StorefrontProduct } from "@/lib/catalogue/storefront";
import { formatPrice } from "@/lib/format-price";

export function CampaignBanner({ product }: { product: StorefrontProduct }) {
  const spotlightImage = product.id === "P1031"
    ? "/images/spotlight/P1031-gold-trench-coat-square.png"
    : product.image;

  return (
    <section id="collection-spotlight" className="mt-8 grid bg-surface lg:grid-cols-2">
      <div className="flex min-h-[420px] flex-col justify-center bg-foreground px-8 py-16 text-background sm:px-12 lg:min-h-[560px] lg:px-20">
        <p className="text-[10px] tracking-[0.28em] uppercase">Collection spotlight</p>
        <h2 className="mt-6 max-w-[10ch] font-serif text-5xl leading-[0.95] italic uppercase lg:text-[64px]">
          {product.name}
        </h2>
        <p className="mt-8 max-w-[38ch] text-[13px] leading-6 text-white/75">
          {product.description ?? `Explore ${product.name} in our current collection.`}
        </p>
        <p className="mt-4 text-sm">{formatPrice(product.price)}</p>
        <Button variant="onDark" href={product.href} className="mt-10 w-fit">
          View product →
        </Button>
      </div>
      <div className="relative aspect-square w-full self-center">
        <div className="absolute inset-0">
          <ProductImage src={spotlightImage} name={product.name} category={product.category}
            fill sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>
      </div>
    </section>
  );
}
