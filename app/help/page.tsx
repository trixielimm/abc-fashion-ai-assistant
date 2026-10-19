import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Shopping help | ABC Fashion",
  description: "Help with browsing the ABC Fashion collection, sizes, your bag and the AI Stylist.",
};

const sections = [
  { id: "browsing", label: "Browse the collection" },
  { id: "sizes-fit", label: "Sizes & fit" },
  { id: "your-bag", label: "Your bag" },
  { id: "orders", label: "Orders & delivery" },
  { id: "ai-stylist", label: "The AI Stylist" },
];

export default function ShoppingHelpPage() {
  return <>
    <div className="border-b border-border bg-surface">
      <Container className="py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-[11px] tracking-[0.16em] uppercase">
          <Link href="/" className="underline underline-offset-4">ABC Fashion</Link>
          <span aria-hidden="true"> / </span><span>Shopping help</span>
        </nav>
        <h1 className="mt-5 font-serif text-4xl sm:text-6xl">Shopping help</h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-muted">
          A guide to finding pieces, checking product details and making the most of your visit.
        </p>
        <Button href="/search" className="mt-7">Explore the collection →</Button>
      </Container>
    </div>

    <Container className="grid gap-10 py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20 lg:py-20">
      <nav aria-label="On this page" className="lg:sticky lg:top-8 lg:self-start">
        <p className="text-[10px] tracking-[0.2em] uppercase">On this page</p>
        <ul className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-1">
          {sections.map(section => <li key={section.id}>
            <Link href={`#${section.id}`} className="underline-offset-4 hover:text-foreground hover:underline">{section.label}</Link>
          </li>)}
        </ul>
      </nav>

      <article className="max-w-3xl space-y-10 text-sm leading-7 text-foreground/80 [&_h2]:mb-4 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:text-foreground [&_p+p]:mt-4 [&_a]:underline [&_a]:underline-offset-4">
        <section id="browsing" className="scroll-mt-8">
          <h2>Browse the collection</h2>
          <p>
            Search by product name, colour or style, then refine the results by collection, category, size or price.
            Remove selected filters individually, or use Clear filters to start again.
          </p>
          <p>
            Explore the <Link href="/search?gender=women">women&apos;s collection</Link>,
            the <Link href="/search?gender=men">men&apos;s collection</Link> or
            our <Link href="/search?category=accessories">accessories</Link>.
          </p>
        </section>

        <section id="sizes-fit" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Sizes &amp; fit</h2>
          <p>
            Open a product page to check its available sizes, material and recorded fit.
            Choose a size and quantity before adding it to your bag.
          </p>
          <p>
            Size labels vary between products and categories. Check the individual product details;
            the AI Stylist cannot guarantee how a piece will fit you.
          </p>
        </section>

        <section id="your-bag" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Your bag</h2>
          <p>
            Your selections are saved in this browser. Open <Link href="/cart">your bag</Link> to
            review items, change quantities or remove a piece. Adding an item does not reserve stock.
          </p>
        </section>

        <section id="orders" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Orders &amp; delivery</h2>
          <p>
            ABC Fashion is currently a browsing prototype. Checkout, payment and order placement are unavailable,
            so adding a piece to your bag does not place an order.
          </p>
          <p>
            Live shipping fees, delivery estimates and shipment tracking are unavailable.
            The AI Stylist cannot confirm an arrival date.
          </p>
        </section>

        <section id="ai-stylist" className="scroll-mt-8 border-t border-border pt-10">
          <h2>The AI Stylist</h2>
          <p>
            Open AI Stylist from the navigation or the floating stylist button.
            Tell it which pieces you want, the occasion and any preferences such as collection, colour, size or budget.
            You can refine your request as you browse.
          </p>
          <p>
            The stylist uses catalogue information to suggest options. Check the product page for current prices,
            available sizes and details before adding an item to your bag.
            Read the <Link href="/terms-of-service">AI Stylist terms</Link> and
            <Link href="/terms-of-service#privacy"> privacy information</Link> before sharing personal details.
          </p>
        </section>
      </article>
    </Container>
  </>;
}
