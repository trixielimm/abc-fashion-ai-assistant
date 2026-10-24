import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "AI Stylist Terms of Service | ABC Fashion",
  description:
    "How the ABC Fashion AI Stylist works, the information it handles, and your rights under Australian law.",
};

const sections = [
  { id: "service", label: "About the stylist" },
  { id: "use", label: "Using the service" },
  { id: "privacy", label: "Privacy & personal information" },
  { id: "accuracy", label: "Recommendations & purchases" },
  { id: "rights", label: "Your rights" },
  { id: "changes", label: "Changes & governing law" },
];

export default function TermsOfServicePage() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <Container className="py-14 sm:py-20">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase">
            ABC Fashion / AI Stylist
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
            Terms of Service
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Please read these terms before using the AI Stylist. They explain
            what the current service does, how it handles what you type, and
            where Australian consumer and privacy protections fit in.
          </p>
          <p className="mt-5 text-[11px] tracking-[0.1em] text-muted uppercase">
            Last updated 20 October 2026
          </p>
        </Container>
      </div>

      <Container className="grid gap-12 py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20 lg:py-20">
        <nav aria-label="On this page" className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase">
            On this page
          </p>
          <ol className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="transition-colors hover:text-foreground focus-visible:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl space-y-12 text-sm leading-7 text-foreground/80 [&_h2]:mb-4 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:text-foreground [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <section id="service" className="scroll-mt-8">
            <h2>About the stylist</h2>
            <p>
              The ABC Fashion AI Stylist is an optional shopping assistant for
              identifying shopping preferences from your messages. It is
              available to visitors who choose to open it.
              By using the stylist, you agree to these terms. You can close it
              and continue shopping at any time.
            </p>
            <p>
              Your messages help the AI identify shopping preferences such as
              category, colour, size, occasion, and budget. It uses recent
              conversation context and active preferences for follow-up
              questions, written answers, and catalogue searches. A single-item
              search can show up to five products. Requests for two to four
              outfit pieces can show up to five choices per piece under one
              combined budget. Check the reply to confirm that a requested
              change has been understood. The stylist is an AI assistant.
            </p>
          </section>

          <section id="use" className="scroll-mt-8 border-t border-border pt-10">
            <h2>Using the service</h2>
            <p>
              Use the stylist for your own shopping and styling questions. Do
              not submit someone else&apos;s personal information without their
              permission, unlawful or abusive material, or content that
              infringes another person&apos;s rights. Do not interfere with the
              service or try to access its underlying systems without
              authorisation.
            </p>
            <p>
              Please avoid entering sensitive information, such as health
              details, biometric information, government identifiers, payment
              card details, or passwords. The stylist does not need these to
              identify shopping preferences. If you do not want to share
              sizing or fit details, you can still browse the site without
              using the stylist.
            </p>
          </section>

          <section id="privacy" className="scroll-mt-8 border-t border-border pt-10">
            <h2>Privacy &amp; personal information</h2>
            <p>
              When you send a message, it goes to the ABC Fashion server and
              then to OpenAI&apos;s API with recent conversation context,
              shopping preferences, and relevant product or styling context
              to interpret the request. Relevant catalogue information may
              also be sent to help prepare a grounded response. The chat,
              preferences, and saved look remain in memory during the current
              page session; they are not saved as an account chat history.
              Closing and reopening the chat keeps that session. New chat or
              reloading the page clears the conversation and saved look.
              Where browser storage is available, whether optional suggestions
              have been shown, hidden, or paused is kept in this tab across
              reloads. These settings do not include messages or product IDs;
              New chat clears them. The shopping bag is stored
              separately in this browser and is not cleared by New chat.
            </p>
            <p>
              If the site operator enables recommendation analytics, the app
              can save interaction events such as product actions and session
              identifiers to its database. These events do not contain raw
              chat messages. This optional event collection is separate from
              the conversation kept in page memory.
            </p>
            <p>
              We request that OpenAI not store response state, but OpenAI may
              retain request information for abuse monitoring under its{" "}
              <a
                href="https://developers.openai.com/api/docs/guides/your-data"
                className="underline underline-offset-2"
              >
                API data controls
              </a>
              . Processing may occur outside Australia. The current stylist
              does not save preferences for later visits or make automated
              decisions about your eligibility, rights, or purchases.
            </p>
            <p>
              Where applicable, the Privacy Act 1988 (Cth) and{" "}
              <a
                href="https://www.oaic.gov.au/privacy/australian-privacy-principles"
                className="underline underline-offset-2"
              >
                Australian Privacy Principles
              </a>{" "}
              govern personal information handling. Sensitive information
              requires particular care and, generally, consent. Website
              infrastructure may also process ordinary technical data needed
              to deliver the site; this section describes the stylist feature.
            </p>
          </section>

          <section id="accuracy" className="scroll-mt-8 border-t border-border pt-10">
            <h2>Recommendations &amp; purchases</h2>
            <p>
              The AI can misunderstand a request. Check
              its written reply and restate anything it missed or
              misunderstood. Recommendations may differ in occasion, style,
              fit, or season when an exact match is unavailable. Check the
              product details, selected size, availability, and AUD price
              before adding an item to your bag. A saved look is a styling
              shortlist, separate from the bag. Sample measurements, care
              instructions, and other prototype specifications are labelled
              as synthetic and are not supplier-verified fit advice.
              Recommendations and cart
              selections do not reserve stock or place an order. Cart
              quantity changes do not recheck live stock. Checkout and
              payment are unavailable in this prototype.
            </p>
            <p>
              The stylist is not a source of medical or other professional
              advice. You can stop using it at any time.
            </p>
          </section>

          <section id="rights" className="scroll-mt-8 border-t border-border pt-10">
            <h2>Your rights</h2>
            <p>
              Nothing in these terms excludes, restricts, or modifies rights
              or remedies that cannot be excluded under the{" "}
              <a
                href="https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees"
                className="underline underline-offset-2"
              >
                Australian Consumer Law
              </a>
              , including applicable consumer guarantees. To the extent
              permitted by law, we do not promise that the stylist will always
              be available or that every extracted field will be accurate.
            </p>
            <p>
              The current app does not keep an account chat history for ABC
              Fashion to retrieve or correct. If you have a
              concern about personal information handled by the site, you may
              email the site operator at{" "}
              <a href="mailto:support@abcandco.com" className="underline underline-offset-2">
                support@abcandco.com
              </a>
              . Where the Privacy Act applies, you may also learn about
              making a complaint to the{" "}
              <a
                href="https://www.oaic.gov.au/privacy/privacy-complaints"
                className="underline underline-offset-2"
              >
                Office of the Australian Information Commissioner
              </a>
              .
            </p>
          </section>

          <section id="changes" className="scroll-mt-8 border-t border-border pt-10">
            <h2>Changes &amp; governing law</h2>
            <p>
              We may change or withdraw the stylist. If its data handling or
              functionality materially changes, we will update these terms and
              give clear notice before the changed service is offered, and
              seek any consent required by law. These terms are governed by
              the laws of New South Wales, Australia, subject to applicable
              Australian law.
            </p>
            <p>
              You can return to the{" "}
              <Link href="/" className="underline underline-offset-2">
                shop
              </Link>{" "}
              at any time without using the stylist.
            </p>
          </section>
        </article>
      </Container>
    </>
  );
}
