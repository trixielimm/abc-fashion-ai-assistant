import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";

export function ShoppingGuide() {
  return <section className="py-16 sm:py-20">
    <Container>
      <div className="mx-auto max-w-[560px] text-center">
        <p className="text-[11px] tracking-[0.28em] uppercase">Here to help</p>
        <h2 className="mt-4 font-serif text-3xl sm:text-4xl">A little direction for your next find.</h2>
        <p className="mt-5 text-sm leading-7 text-muted">
          Explore our guide to browsing the collection, choosing a size and getting help from the AI Stylist.
        </p>
        <Button href="/help" className="mt-7">Shopping help →</Button>
      </div>
    </Container>
  </section>;
}
