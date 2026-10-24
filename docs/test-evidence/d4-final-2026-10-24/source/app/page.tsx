import { Suspense } from "react";
import Link from "next/link";
import { CampaignBanner } from "@/components/landing/CampaignBanner";
import { CategoryShowcase } from "@/components/landing/CategoryShowcase";
import { Hero } from "@/components/landing/Hero";
import { ShoppingGuide } from "@/components/landing/ShoppingGuide";
import { ProductCarousel } from "@/components/commerce/ProductCarousel";
import { Container } from "@/components/layout/Container";
import { getLandingContent } from "@/lib/catalogue/landing";

async function LandingCollection() {
  let collection;
  try {
    collection = await getLandingContent();
  } catch {
    console.error("Landing page collection unavailable.");
  }

  if (!collection?.featured.length) {
    return <section id="featured-categories" className="scroll-mt-8 py-16">
      <div id="this-season" className="scroll-mt-8"><Container>
        <h2 className="font-serif text-3xl">The collection is temporarily unavailable</h2>
        <p className="mt-4 text-sm text-muted">Please try again shortly.</p>
        <Link href="/search" className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Browse the collection</Link>
      </Container></div>
    </section>;
  }

  return <>
    <CategoryShowcase categories={collection.categories} />
    <ProductCarousel title="This Season" products={collection.featured} />
    {collection.spotlight ? <CampaignBanner product={collection.spotlight} /> : null}
  </>;
}

export default function Home() {
  return (
    <>
      <Hero />
      <Suspense fallback={<section id="featured-categories" className="scroll-mt-8 py-16"><div id="this-season" className="scroll-mt-8"><Container><p role="status" className="text-sm text-muted">Loading the collection…</p></Container></div></section>}>
        <LandingCollection />
      </Suspense>
      <ShoppingGuide />
    </>
  );
}
