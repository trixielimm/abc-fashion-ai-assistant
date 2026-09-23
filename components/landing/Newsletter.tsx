"use client";

import { type FormEvent, useState } from "react";

export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-[560px] text-center">
        <p className="text-[11px] tracking-[0.32em] uppercase">Stay informed</p>
        <p className="mt-4 text-[13px] leading-6 text-muted">
          Join us on our journey for early access to new collections and
          exclusive offers for members.
        </p>
        {submitted ? (
          <p className="mt-8 text-[13px] text-foreground">
            Thank you. We will be in touch.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              placeholder="EMAIL ADDRESS"
              className="min-w-0 flex-1 border-0 border-b border-foreground bg-transparent px-0 py-2.5 text-[11px] tracking-[0.16em] text-foreground outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="bg-foreground px-8 py-3 text-[11px] tracking-[0.2em] text-background uppercase"
            >
              Subscribe
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
