import { CategoryCard } from "@/components/commerce/CategoryCard";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { CategoryTile } from "@/lib/mock-data";

export function CategoryShowcase({ categories }: { categories: CategoryTile[] }) {
  return (
    <section id="featured-categories" className="scroll-mt-8 py-12 lg:py-16">
      <Container>
        <SectionHeader
          label="Featured Categories"
          action={
            <Button variant="ghost" href="#this-season">
              Shop all →
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>
    </section>
  );
}
