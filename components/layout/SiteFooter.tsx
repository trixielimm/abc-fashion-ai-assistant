import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Container } from "@/components/layout/Container";
import { getLandingContent } from "@/lib/catalogue/landing";
import { footerHelpLinks, footerShopLinks } from "@/lib/navigation";

async function CollectionPreview() {
  const collection = await getLandingContent().catch(() => null);
  if (!collection?.featured.length) {
    return <Link href="/search" className="mt-4 inline-flex min-h-11 items-center text-xs underline underline-offset-4">Explore the collection →</Link>;
  }

  return <div className="mt-4 grid max-w-[168px] grid-cols-2 gap-1.5">
    {collection.featured.slice(0, 4).map(product => <Link key={product.id} href={product.href}
      aria-label={product.name} className="relative aspect-square overflow-hidden">
      <div className="absolute inset-0">
        <ProductImage src={product.image} name={product.name} category={product.category}
          fill compact sizes="80px" />
      </div>
    </Link>)}
  </div>;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <div>
          <p className="flex items-center gap-2 font-serif text-[15px] italic">
            <Image
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden
              className="h-[22px] w-[22px] shrink-0"
            />
            ABC Fashion
          </p>
          <p className="mt-6 text-[10px] leading-5 tracking-[0.16em] text-muted uppercase">
            Copenhagen &amp; Stockholm
            <br />
            London / Paris / New York
          </p>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            From the collection
          </p>
          <Suspense fallback={<div className="mt-4 aspect-square max-w-[168px] animate-pulse bg-surface" aria-label="Loading collection preview" />}>
            <CollectionPreview />
          </Suspense>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            Shop
          </p>
          <ul className="mt-4 space-y-2.5">
            {footerShopLinks.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-[12px] text-foreground/80 transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            Help &amp; information
          </p>
          <ul className="mt-4 space-y-2.5">
            {footerHelpLinks.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-[12px] text-foreground/80 transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-border py-5 text-[10px] tracking-[0.14em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
        <div><p>© 2026 ABC Fashion Inc. All rights reserved.</p>
          <p className="mt-2 normal-case tracking-normal">Prototype store — sample products and AI-generated specifications.</p>
        </div>
        <p className="flex gap-4">
          <Link href="/terms-of-service" className="hover:text-foreground">
            AI Terms
          </Link>
          <Link href="/terms-of-service#privacy" className="hover:text-foreground">
            AI Privacy
          </Link>
        </p>
      </Container>
    </footer>
  );
}
