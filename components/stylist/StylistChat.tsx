"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, PersonIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { stylistSuggestions } from "@/lib/mock-data";
import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "@/lib/ai/preferenceSchema";

type Entry = {
  id: string;
  from: "stylist" | "you";
  text: string;
  preferences?: ShoppingPreferences;
};

const GREETING =
  "Welcome to ABC Fashion. Tell me what you're shopping for, and I'll identify the preferences in your request.";

const preferenceFields: { key: keyof ShoppingPreferences; label: string }[] = [
  { key: "gender", label: "Collection" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "product_type", label: "Product type" },
  { key: "occasion", label: "Occasion" },
  { key: "style", label: "Style" },
  { key: "preferred_colours", label: "Preferred colours" },
  { key: "excluded_colours", label: "Excluded colours" },
  { key: "season", label: "Season" },
  { key: "material", label: "Material" },
  { key: "fit", label: "Fit" },
  { key: "size", label: "Size" },
  { key: "min_price", label: "Minimum price" },
  { key: "max_price", label: "Maximum price" },
  { key: "brand_line", label: "Brand line" },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Avatar({ from }: { from: Entry["from"] }) {
  if (from === "you") {
    return (
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center border border-hairline bg-background">
        <PersonIcon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center bg-foreground font-serif text-[9px] tracking-[0.08em] text-background">
      ABC
    </span>
  );
}

function PreferenceDetails({ preferences }: { preferences: ShoppingPreferences }) {
  const found = preferenceFields.flatMap(({ key, label }) => {
    const value = preferences[key];
    if (value === null || (Array.isArray(value) && value.length === 0)) return [];

    const display = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "number"
        ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value)
        : value;

    return [{ label, display }];
  });

  if (found.length === 0) {
    return (
      <p>
        No shopping preferences found in that message. Try adding a colour,
        size, occasion, or budget.
      </p>
    );
  }

  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
        Preferences found
      </p>
      <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {found.map(({ label, display }) => (
          <div key={label}>
            <dt className="text-[10px] tracking-[0.08em] text-muted uppercase">
              {label}
            </dt>
            <dd className="font-medium">{display}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-4" aria-live="polite">
      <Avatar from="stylist" />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <div className="flex items-baseline gap-2">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
            AI Stylist
          </p>
          <p className="text-[10px] text-muted">Just now</p>
        </div>
        <div className="mt-2 border border-hairline bg-surface px-4 py-3.5">
          <span className="sr-only">AI Stylist is typing</span>
          <span aria-hidden className="flex h-4 items-end gap-1">
            {[0, 140, 280].map((delay) => (
              <span
                key={delay}
                className="stylist-bounce h-1.5 w-1.5 rounded-full bg-foreground"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function TypewriterText({
  text,
  onTick,
  onComplete,
}: {
  text: string;
  onTick: () => void;
  onComplete: () => void;
}) {
  const words = text.split(" ");
  const [shown, setShown] = useState(0);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onTickRef.current = onTick;
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const tokens = text.split(" ");
    if (shown >= tokens.length) return;

    const reduced = prefersReducedMotion();
    const word = tokens[shown];
    const pause = reduced
      ? 0
      : /[.!?]$/.test(word)
        ? 240
        : /[,;:]$/.test(word)
          ? 120
          : 0;
    const timeout = window.setTimeout(() => {
      const next = shown + 1;
      setShown(next);
      onTickRef.current();
      if (next >= tokens.length) onCompleteRef.current();
    }, reduced ? 0 : 70 + pause);

    return () => window.clearTimeout(timeout);
  }, [shown, text]);

  return <>{words.slice(0, shown).join(" ")}</>;
}

function Message({
  entry,
  live,
  onTick,
  onTyped,
}: {
  entry: Entry;
  live?: boolean;
  onTick?: () => void;
  onTyped?: () => void;
}) {
  const isYou = entry.from === "you";
  return (
    <div className={cn("flex gap-4", isYou && "flex-row-reverse")}>
      <Avatar from={entry.from} />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isYou ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "flex items-baseline gap-2",
            isYou && "flex-row-reverse",
          )}
        >
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
            {isYou ? "You" : "AI Stylist"}
          </p>
          <p className="text-[10px] text-muted">Just now</p>
        </div>
        <div
          className={cn(
            "mt-2 max-w-full border p-4 text-[14px] leading-6 sm:max-w-[74%]",
            isYou
              ? "border-foreground bg-foreground text-background"
              : "border-hairline bg-surface",
          )}
        >
          {entry.preferences ? (
            <PreferenceDetails preferences={entry.preferences} />
          ) : live && onTick && onTyped ? (
            <p>
              <TypewriterText
                text={entry.text}
                onTick={onTick}
                onComplete={onTyped}
              />
            </p>
          ) : (
            <p>{entry.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StylistChat({
  onClose,
  onReset,
}: {
  onClose: () => void;
  onReset: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<Entry | null>(null);
  const [thinking, setThinking] = useState(true);
  const [draft, setDraft] = useState("");
  const [tick, setTick] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const replyCount = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const busy = thinking || pending !== null;

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [entries, pending, thinking, tick]);

  useEffect(() => {
    let cancelled = false;

    async function greet() {
      await sleep(prefersReducedMotion() ? 120 : 900);
      if (cancelled) return;
      setThinking(false);
      setPending({
        id: "welcome",
        from: "stylist",
        text: GREETING,
      });
    }

    void greet();

    return () => {
      cancelled = true;
    };
  }, []);

  function commitPending(entry: Entry) {
    setEntries((current) => {
      if (current.some((item) => item.id === entry.id)) return current;
      return [...current, entry];
    });
    setPending(null);
  }

  async function extract(message: string) {
    const controller = new AbortController();
    requestRef.current = controller;
    setThinking(true);

    try {
      const response = await fetch("/api/extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Preference extraction failed.");

      const data: unknown = await response.json();
      const parsed = ShoppingPreferencesSchema.safeParse(
        typeof data === "object" && data !== null && "preferences" in data
          ? data.preferences
          : undefined,
      );
      if (!parsed.success) throw new Error("Invalid preference response.");

      replyCount.current += 1;
      setEntries((current) => [
        ...current,
        {
          id: `preferences-${replyCount.current}`,
          from: "stylist",
          text: "",
          preferences: parsed.data,
        },
      ]);
    } catch {
      if (controller.signal.aborted) return;
      replyCount.current += 1;
      setEntries((current) => [
        ...current,
        {
          id: `error-${replyCount.current}`,
          from: "stylist",
          text: "I couldn't extract preferences from that message. Please try again.",
        },
      ]);
    } finally {
      if (!controller.signal.aborted) setThinking(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function send() {
    const message = draft.trim();
    if (!message || busy) return;

    setEntries((current) => [
      ...current,
      { id: `you-${current.length}`, from: "you", text: message },
    ]);
    setDraft("");
    void extract(message);
  }

  return (
    <div className="flex h-[min(680px,88vh)] flex-col">
      <header className="flex items-start gap-3 border-b border-hairline bg-surface px-6 py-5">
        <span
          aria-hidden
          className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-serif text-[15px] tracking-[0.16em] uppercase">
              AI Stylist
            </p>
            <span className="border border-hairline bg-panel px-2 py-1 text-[9px] tracking-[0.14em] uppercase">
              ABC Concierge
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Share what you&apos;re looking for to see your shopping preferences
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset chat"
            className="border border-hairline bg-panel px-3 py-2 text-[10px] font-medium tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stylist"
            className="border border-hairline bg-panel p-2 transition-opacity hover:opacity-60"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <aside
        aria-label="AI Stylist terms notice"
        className="border-b border-hairline bg-background px-6 py-3 text-[11px] leading-5 text-muted sm:px-8"
      >
        Your message is sent to OpenAI to extract shopping preferences. By using
        this stylist, you agree to the{" "}
        <Link
          href="/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2"
        >
          AI Stylist Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link
          href="/terms-of-service#privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2"
        >
          privacy information
        </Link>
        .
      </aside>

      <div
        ref={transcriptRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={busy}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-panel px-6 py-6 sm:px-8"
      >
        {[...entries, ...(pending ? [pending] : [])].map((entry) => (
          <Message
            key={entry.id}
            entry={entry}
            live={pending?.id === entry.id}
            onTick={() => setTick((value) => value + 1)}
            onTyped={() => commitPending(entry)}
          />
        ))}
        {thinking ? <TypingDots /> : null}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline bg-panel px-6 py-2.5">
        <span className="shrink-0 text-[10px] tracking-[0.14em] text-muted uppercase">
          Suggestions:
        </span>
        {stylistSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setDraft(suggestion)}
            className="shrink-0 border border-hairline bg-surface px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-center gap-3 border-t border-hairline bg-surface px-5 py-5"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          aria-label="Message your stylist"
          placeholder="e.g. a black dress under $150 for a wedding in size 10"
          className="h-[46px] min-w-0 flex-1 border border-hairline bg-panel px-4 text-[14px] outline-none placeholder:text-muted focus:border-foreground"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-[46px] shrink-0 items-center gap-2 bg-foreground px-6 text-[11px] font-medium tracking-[0.16em] text-background uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Send ↑
        </button>
      </form>
    </div>
  );
}
