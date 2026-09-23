import { CampaignBanner } from "@/components/landing/CampaignBanner";
import { CategoryShowcase } from "@/components/landing/CategoryShowcase";
import { Hero } from "@/components/landing/Hero";
import { Newsletter } from "@/components/landing/Newsletter";
import { ProductCarousel } from "@/components/commerce/ProductCarousel";
import { categoryTiles, featuredProducts } from "@/lib/mock-data";

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryShowcase categories={categoryTiles} />
      <ProductCarousel title="This Season" products={featuredProducts} />
      <CampaignBanner />
      <Newsletter />
    </>
  );
}
