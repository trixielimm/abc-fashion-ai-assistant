import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { CategoryTile } from "@/lib/mock-data";

/**
 * The cross-fade must never show the resting label and the centred block at the
 * same time, so each side carries its own enter/leave timing: the outgoing
 * element always runs first with no delay, the incoming one waits for it.
 */
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

const RESTING_LABEL = cn(
  "absolute bottom-4 left-4 text-[11px] tracking-[0.22em] text-white uppercase",
  "[text-shadow:0_1px_8px_rgba(0,0,0,0.45)]",
  "transition-opacity",
  EASE,
  // Leaving hover: fade back in only after the centred block has gone.
  "opacity-100 duration-[350ms] delay-[250ms]",
  // Entering hover: leave immediately.
  "group-hover:opacity-0 group-hover:duration-[250ms] group-hover:delay-0",
  "group-focus-visible:opacity-0 group-focus-visible:duration-[250ms] group-focus-visible:delay-0",
  // Touch devices rest in the rich state, so the label is never shown.
  "no-hover:hidden",
);

const HOVER_PANEL = cn(
  "absolute inset-0 flex flex-col items-center justify-center px-6 text-center",
  "transition-opacity",
  EASE,
  // Leaving hover: go immediately so the resting label can follow.
  "opacity-0 duration-[250ms] delay-0",
  "group-hover:opacity-100 group-hover:duration-[350ms] group-hover:delay-[150ms]",
  "group-focus-visible:opacity-100 group-focus-visible:duration-[350ms] group-focus-visible:delay-[250ms]",
  "no-hover:opacity-100 no-hover:delay-0",
);

// Stagger classes are spelled out in full: Tailwind only sees literal tokens.
const RISE = cn(
  "translate-y-3 transition-transform duration-[350ms] delay-0",
  EASE,
  "group-hover:translate-y-0 group-focus-visible:translate-y-0",
  "no-hover:translate-y-0",
);
const RISE_TITLE = "group-hover:delay-[250ms] group-focus-visible:delay-[250ms]";
const RISE_BODY = "group-hover:delay-[300ms] group-focus-visible:delay-[300ms]";
const RISE_ACTION =
  "group-hover:delay-[350ms] group-focus-visible:delay-[350ms]";

export function CategoryCard({ category }: { category: CategoryTile }) {
  return (
    <Link
      href={category.href}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <article className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={category.image}
          alt={category.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className={cn(
            "object-cover transition-transform duration-[650ms]",
            EASE,
            "group-hover:scale-[1.03] group-focus-visible:scale-[1.03]",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-black/0 transition-colors duration-[650ms]",
            EASE,
            "group-hover:bg-black/45 group-focus-visible:bg-black/45",
            "no-hover:bg-black/45",
          )}
        />
        <p aria-hidden="true" className={RESTING_LABEL}>
          {category.name}
        </p>
        <div className={HOVER_PANEL}>
          <h3
            className={cn(
              "text-[13px] tracking-[0.3em] text-white uppercase sm:text-sm",
              RISE,
              RISE_TITLE,
            )}
          >
            {category.name}
          </h3>
          <p
            className={cn(
              "mt-3 max-w-[280px] text-[12px] leading-relaxed text-white/85",
              RISE,
              RISE_BODY,
            )}
          >
            {category.description}
          </p>
          <span
            aria-hidden="true"
            className={cn(
              "mt-5 border-b border-white/60 pb-1 text-[10px] tracking-[0.25em] text-white uppercase",
              RISE,
              RISE_ACTION,
            )}
          >
            See more →
          </span>
        </div>
      </article>
    </Link>
  );
}
