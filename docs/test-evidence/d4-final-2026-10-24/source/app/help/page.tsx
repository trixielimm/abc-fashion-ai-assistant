import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Shopping help | ABC Fashion",
  description: "Find shopping help for the ABC Fashion AI Stylist, optional recommendations, saved looks, outfit budgets, sizes and your bag.",
};

const sections = [
  { id: "browsing", label: "Browse the collection" },
  { id: "sizes-fit", label: "Sizes & fit" },
  { id: "your-bag", label: "Your bag" },
  { id: "orders", label: "Orders & delivery" },
  { id: "ai-stylist", label: "The AI Stylist" },
  { id: "recommendations", label: "Recommendations & extras" },
  { id: "your-look", label: "Your look & budget" },
  { id: "chat-controls", label: "Chat controls & privacy" },
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
          Find pieces, build a look and get more from the AI Stylist, with you in control of what you save and buy.
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

      <article className="max-w-3xl space-y-10 text-sm leading-7 text-foreground/80 [&_h2]:mb-4 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:text-foreground [&_p+p]:mt-4 [&_a]:underline [&_a]:underline-offset-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
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
            Tell it what you are shopping for, the occasion and any preferences such as collection, colour, size or budget.
            You can start without knowing your size or spending limit, or ask for help exploring styles.
            The stylist may ask a follow-up question when it needs a detail to continue.
          </p>
          <p>
            Refine the same search with requests such as &ldquo;cheaper&rdquo;, &ldquo;show blue instead&rdquo;
            or &ldquo;keep my budget, but change the size to 12&rdquo;. Check the shopping request summary
            to see the preferences currently being used. Name a product, or refer to &ldquo;the second dress&rdquo;,
            to ask about its material, price or recorded details, or compare it with another option.
          </p>
          <div className="mt-6 border border-border bg-surface p-5 sm:p-6">
            <h3 className="font-medium text-foreground">Try asking</h3>
            <ul>
              <li>&ldquo;Find a women&apos;s dress for a beach wedding under A$200. I don&apos;t know my size yet.&rdquo;</li>
              <li>&ldquo;Help me find something for work.&rdquo;</li>
              <li>&ldquo;Find a dress and shoes for a wedding, with a combined budget of A$300.&rdquo;</li>
            </ul>
          </div>
          <p>
            Suggestions use recorded catalogue information. If there is no exact match, the stylist may
            explain the limit or show labelled alternatives. If a requirement cannot be verified, it may
            ask whether to keep it, remove it or browse with that detail marked as unverified.
            Check product details, available sizes and AUD prices before choosing a piece. Prototype
            specifications labelled as synthetic are sample information, not supplier-verified fit advice.
          </p>
        </section>

        <section id="recommendations" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Recommendations &amp; extras</h2>
          <p>
            When your request includes an occasion and suitable matching stock is available, the stylist
            may show up to two products under <strong>Optional finishing touches</strong>, such as a bag
            to go with a dress. You can see the item they are paired with, their prices and the recorded
            reasons for the pairing. These are optional styling examples; displaying them does not select
            any item for your look or add anything to your bag.
          </p>
          <p>
            A dress-only budget applies to the dress. Optional additions are priced separately unless you
            have set a combined purchase budget. To plan the whole purchase, name the pieces you want and
            give one total, such as &ldquo;a dress and shoes under A$300 altogether&rdquo;.
          </p>
          <ul>
            <li>Use <strong>Match a different dress</strong> or <strong>Match a different item</strong>, when shown, to pair additions with another displayed option.</li>
            <li>Choose <strong>Hide these suggestions</strong> to dismiss the current additions, or <strong>No more extras</strong> to pause unsolicited recommendations.</li>
            <li>Say &ldquo;only a dress, no extras&rdquo; at the start if you want to focus on one item. You can still explicitly ask for a matching bag or another piece later.</li>
            <li>Tell the stylist what you already own, such as &ldquo;I already have a bag and shoes&rdquo;, so it can avoid suggesting those roles again.</li>
          </ul>
          <p>
            You can ask why a named addition was suggested or what it costs. Pairing uses recorded product
            attributes; visual compatibility is not verified, and suitable additions may not always be available.
          </p>
        </section>

        <section id="your-look" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Your look &amp; budget</h2>
          <p>
            Choose <strong>Save to look</strong> on a product, or ask the stylist to keep a named piece,
            to build a styling shortlist. Open <strong>View look</strong> to review or remove pieces.
            Saving a piece to your look does not add it to your bag. Use <strong>Add to cart</strong>
            and choose an available size when you want to add it to your bag.
          </p>
          <p>
            You can describe an item you already own and ask for pieces to wear with it. Owned pieces
            are styling references and do not count as new purchases. When building an outfit under one
            combined budget, selected pieces to buy count towards the total. Check the displayed total
            and remaining allowance; a subtotal is labelled when a price is unavailable.
          </p>
          <p>
            Outfit searches can show separate groups for the requested pieces. Choose one option from
            each group to build your look; the alternatives in a group are choices, rather than items
            you are expected to buy together.
          </p>
        </section>

        <section id="chat-controls" className="scroll-mt-8 border-t border-border pt-10">
          <h2>Chat controls &amp; privacy</h2>
          <p>
            Use the cancel control while a request is loading to stop it. If a request fails and
            <strong> Retry this request</strong> appears, you can try it again. If that retry has expired,
            send your message again. Use <strong>New chat</strong> to clear the conversation, shopping
            preferences, saved look and suggestion preferences, then begin a fresh search.
            Your shopping bag is kept separately and is not cleared by New chat.
          </p>
          <p>
            Closing and reopening the stylist keeps the current conversation during your page session.
            Reloading clears the conversation and saved look. When browser storage is available,
            whether optional suggestions were shown, hidden or paused is remembered in the same tab
            across reloads until you use New chat; the messages and product selections are not saved
            with those settings.
          </p>
          <p>
            Your messages and relevant shopping context are sent to our server and OpenAI to interpret
            your request. Avoid sharing payment details, passwords or sensitive personal information.
            Read the <Link href="/terms-of-service">AI Stylist terms</Link> and
            <Link href="/terms-of-service#privacy"> privacy information</Link> for more detail.
          </p>
        </section>
      </article>
    </Container>
  </>;
}
