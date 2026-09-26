import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/cn";
import { productDetailMocks } from "@/lib/product-detail-mock";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = productDetailMocks.find(
    (item) => item.product_id === productId,
  );

  if (
    !product ||
    !product.product_name ||
    product.price_aud === null ||
    !product.image_key
  ) {
    notFound();
  }

  const price = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(product.price_aud);

  return (
    <Container className={cn("py-8 lg:py-12")}>
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-[3/4] overflow-hidden bg-surface">
          <Image
            src={product.image_key}
            alt={product.product_name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <section className="flex flex-col items-start justify-center py-4">
          {product.category ? (
            <p className="text-[11px] tracking-[0.2em] text-muted uppercase">
              {product.category}
            </p>
          ) : null}
          <h1 className="mt-4 font-serif text-3xl text-foreground">
            {product.product_name}
          </h1>
          <p className="mt-4 text-sm text-foreground">{price}</p>
          {product.description ? (
            <p className="mt-6 max-w-prose text-sm leading-6 text-muted">
              {product.description}
            </p>
          ) : null}
        </section>
      </div>
    </Container>
  );
}
