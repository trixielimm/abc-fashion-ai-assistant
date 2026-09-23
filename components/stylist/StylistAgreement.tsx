"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, ShieldIcon } from "@/components/ui/icons";
import { stylistTerms } from "@/lib/mock-data";

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      {/* The tick is always background-coloured, so it only reads once the
          box fills in. */}
      <span className="mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center border border-hairline bg-background peer-checked:border-foreground peer-checked:bg-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground">
        <CheckIcon className="text-background" />
      </span>
      <span>{children}</span>
    </label>
  );
}

export function StylistAgreement({
  onAgree,
  onDecline,
}: {
  onAgree: () => void;
  onDecline: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [remember, setRemember] = useState(false);

  return (
    <div className="max-h-[92vh] overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-[672px]">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 bg-[#eeeeee] px-3 py-2 text-[10px] font-medium tracking-[0.14em] uppercase">
            <ShieldIcon />
            Service Agreement &amp; Privacy Consent
          </span>
        </div>

        <h2 className="mt-7 text-center font-serif text-[26px] leading-tight tracking-[0.04em] uppercase lg:text-[30px]">
          AI Stylist Consultation Agreement
        </h2>

        <div className="mt-8 border border-hairline bg-surface">
          <p className="border-b border-hairline px-6 py-4 text-[11px] font-semibold tracking-[0.14em] uppercase">
            Terms of Service Highlights
          </p>
          <ol className="space-y-4 px-6 py-5">
            {stylistTerms.map((term) => (
              <li key={term.id} className="flex gap-4 text-[13px] leading-6">
                <span className="pt-px text-[11px] font-semibold tabular-nums">
                  {term.id}
                </span>
                <p>
                  <span className="font-semibold">{term.title}:</span>{" "}
                  {term.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-7 space-y-4">
          <Checkbox checked={accepted} onChange={setAccepted}>
            <span className="font-semibold">Required:</span> I have read and
            agree to the{" "}
            <Link href="#" className="underline underline-offset-2">
              AI Stylist Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="underline underline-offset-2">
              ABC Fashion Privacy Policy
            </Link>
            .
          </Checkbox>
          <Checkbox checked={remember} onChange={setRemember}>
            Allow AI Stylist to remember my sizing and fit preferences for
            future visits.
          </Checkbox>
        </div>

        <div className="mt-7 flex flex-col gap-5 border-t border-hairline pt-7 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onDecline}
            className="text-[11px] tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-60"
          >
            Decline &amp; return to shopping
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={!accepted}
            className="inline-flex items-center justify-center gap-2.5 bg-foreground px-8 py-4 text-[11px] font-medium tracking-[0.16em] text-background uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Agree &amp; start styling →
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-muted">
          By clicking &ldquo;Agree &amp; Start Styling&rdquo;, you consent to our
          automated styling concierge assistance. Learn more in our{" "}
          <Link href="#" className="underline underline-offset-2">
            full Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
