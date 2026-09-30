"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, PersonIcon } from "@/components/ui/icons";
import { ProductVisual } from "@/components/commerce/ProductVisual";
import { cn } from "@/lib/cn";
import { addToCart } from "@/lib/cart";
import { SaveProductButton } from "@/components/style/SaveProductButton";
import { signInForSave } from "@/lib/style/pending";
import { MemorySchema, SizeSchema } from "@/lib/style/schema";
import { formatPrice, stylistSuggestions } from "@/lib/mock-data";
import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "@/lib/ai/preferenceSchema";
import { z } from "zod";

const StylistProductSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  price_aud: z.number().nonnegative(),
  brand_line: z.string().nullable(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  product_type: z.string().nullable(),
  colour: z.string().nullable(),
  sizes_available: z.array(z.string().min(1)).min(1),
});

type StylistProduct = z.infer<typeof StylistProductSchema>;

type Entry = {
  id: string;
  from: "stylist" | "you";
  text: string;
  preferences?: ShoppingPreferences;
  products?: StylistProduct[];
  appliedMemories?: string[];
  saveCandidate?: z.infer<typeof SaveCandidateSchema>;
};

const SaveCandidateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("memory"), memory: MemorySchema }),
  z.object({ type: z.literal("size"), size: SizeSchema }),
]);

const TurnResponseSchema = z.object({
  message: z.string(),
  preferences: ShoppingPreferencesSchema,
  products: z.array(StylistProductSchema).max(4),
  applied_memories: z.array(z.string()),
  pending_memory: SaveCandidateSchema.nullable(),
  preferred_name: z.string(),
});

const CHAT_KEY = "abc-fashion-stylist-chat";

const GREETING =
  "Welcome to ABC Fashion. Tell me what you're shopping for, and I'll find a few items that fit your preferences.";

function SaveMemoryButton({ candidate }: { candidate: z.infer<typeof SaveCandidateSchema> }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy || saved) return;
    setBusy(true);
    setError("");
    try {
      let url = "/api/me/style-memories";
      let method = "POST";
      let body: object = candidate.type === "memory" ? candidate.memory : candidate.size;
      if (candidate.type === "size") {
        url = "/api/me/style-profile";
        method = "PATCH";
        const existing = await fetch(url, { cache: "no-store" });
        if (existing.status === 401) { signInForSave({ type: "size", ...candidate.size }); return; }
        if (!existing.ok) throw new Error("Could not load saved sizes.");
        const data = await existing.json();
        body = { sizes: [
          ...(data.profile?.sizes ?? []).filter((size: { item_type: string }) => size.item_type !== candidate.size.item_type),
          candidate.size,
        ] };
      }
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 401) {
        signInForSave(candidate.type === "memory" ? { type: "memory", memory: candidate.memory } : { type: "size", ...candidate.size });
        return;
      }
      if (!response.ok) throw new Error("Could not save memory.");
      setSaved(true);
      window.dispatchEvent(new Event("style-profile-updated"));
    } catch { setError("Could not save that yet. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="mt-3"><button type="button" onClick={save} disabled={busy || saved} className="border border-foreground px-3 py-2 text-[10px] uppercase disabled:opacity-50">{saved ? "Saved to My Style" : "Save to My Style"}</button>{error ? <p role="status" className="mt-2 text-xs">{error}</p> : null}</div>;
}

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

function RecommendationCard({
  product,
  onProductOpen,
}: {
  product: StylistProduct;
  onProductOpen: () => void;
}) {
  const sizes = product.sizes_available;
  const [selectedSize, setSelectedSize] = useState(sizes.length === 1 ? sizes[0] : "");
  const [feedback, setFeedback] = useState("");

  function addProduct() {
    if (!selectedSize) {
      setFeedback("Select a size first.");
      return;
    }

    try {
      addToCart({
        productId: product.product_id,
        size: selectedSize,
        quantity: 1,
        name: product.product_name,
        price: product.price_aud,
        image: null,
        category: product.category,
      });
      setFeedback("Added to cart.");
    } catch {
      setFeedback("Could not add this item. Please try again.");
    }
  }

  return (
    <article className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 border border-hairline bg-background p-3 sm:grid-cols-[88px_minmax(0,1fr)]">
      <Link
        href={`/products/${encodeURIComponent(product.product_id)}`}
        onClick={onProductOpen}
        aria-label={`View ${product.product_name}`}
        className="self-start"
      >
        <ProductVisual
          name={product.product_name}
          category={product.subcategory ?? product.category}
          compact
          className="transition-colors hover:bg-[#e6e0d7]"
        />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-[9px] tracking-[0.12em] text-muted uppercase">
          {product.brand_line ?? product.subcategory ?? product.category ?? "ABC Fashion"}
        </p>
        <Link
          href={`/products/${encodeURIComponent(product.product_id)}`}
          onClick={onProductOpen}
          className="mt-1 block font-serif text-[15px] leading-5 hover:underline hover:underline-offset-2"
        >
          {product.product_name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[12px]">
          <span className="text-muted">{product.colour}</span>
          <span>{formatPrice(product.price_aud)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sizes.length === 1 ? (
            <span className="flex min-h-9 items-center text-[11px] text-muted">
              Size: {sizes[0]}
            </span>
          ) : (
            <label className="min-w-[90px] flex-1">
              <span className="sr-only">Size for {product.product_name}</span>
              <select
                value={selectedSize}
                onChange={(event) => {
                  setSelectedSize(event.target.value);
                  setFeedback("");
                }}
                className="h-9 w-full border border-hairline bg-background px-2 text-[11px]"
              >
                <option value="">Select size</option>
                {sizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={addProduct}
            className="min-h-9 min-w-[105px] flex-1 bg-foreground px-3 text-[10px] font-medium tracking-[0.08em] text-background uppercase transition-opacity hover:opacity-80"
          >
            Add to cart
          </button>
        </div>
        {feedback ? <p role="status" className="mt-2 text-[11px]">{feedback}</p> : null}
        <SaveProductButton productId={product.product_id} className="mt-2" />
      </div>
    </article>
  );
}

function ProductRecommendations({
  products,
  onProductOpen,
}: {
  products: StylistProduct[];
  onProductOpen: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-hairline pt-4 lg:grid-cols-2">
      {products.map((product) => (
        <RecommendationCard
          key={product.product_id}
          product={product}
          onProductOpen={onProductOpen}
        />
      ))}
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
  onProductOpen,
}: {
  entry: Entry;
  live?: boolean;
  onTick?: () => void;
  onTyped?: () => void;
  onProductOpen: () => void;
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
            "mt-2 max-w-full border p-4 text-[14px] leading-6",
            !entry.products?.length && "sm:max-w-[74%]",
            isYou
              ? "border-foreground bg-foreground text-background"
              : "border-hairline bg-surface",
          )}
        >
          {entry.preferences ? (
            <PreferenceDetails preferences={entry.preferences} />
          ) : entry.products?.length ? (
            <div>
              <p>{entry.text}</p>
              {entry.appliedMemories?.length ? <p className="mt-2 text-xs text-muted">{entry.appliedMemories.join(" · ")} · <Link href="/my-style" onClick={onProductOpen} className="underline">Change in My Style</Link></p> : null}
              <ProductRecommendations products={entry.products} onProductOpen={onProductOpen} />
            </div>
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
          {entry.saveCandidate ? <SaveMemoryButton candidate={entry.saveCandidate} /> : null}
          {!entry.products?.length && entry.appliedMemories?.length ? <p className="mt-2 text-xs text-muted">{entry.appliedMemories.join(" · ")} · <Link href="/my-style" onClick={onProductOpen} className="underline">Change in My Style</Link></p> : null}
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
      try {
        const stored: unknown = JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "null");
        if (Array.isArray(stored) && stored.length) {
          const valid = stored.filter((entry): entry is Entry =>
            !!entry && typeof entry === "object" && typeof entry.id === "string" &&
            (entry.from === "stylist" || entry.from === "you") && typeof entry.text === "string",
          ).slice(-30);
          if (valid.length) { replyCount.current = valid.length; setEntries(valid); setThinking(false); return; }
        }
      } catch { /* Ignore invalid session chat. */ }
      let greeting = GREETING;
      try {
        const response = await fetch("/api/me/style-profile", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          const name = data.profile?.preferred_name;
          if (typeof name === "string" && name.trim()) greeting = `Welcome back, ${name.trim()}. What are you looking for today?`;
        }
      } catch { /* Guest greeting is still available. */ }
      await sleep(prefersReducedMotion() ? 120 : 900);
      if (cancelled) return;
      setThinking(false);
      setPending({
        id: "welcome",
        from: "stylist",
        text: greeting,
      });
    }

    void greet();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (entries.length) sessionStorage.setItem(CHAT_KEY, JSON.stringify(entries.slice(-30)));
  }, [entries]);

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
      const recentTurns = entries.filter((entry) => entry.text.trim()).slice(-6).map((entry) => ({
        role: entry.from === "you" ? "user" as const : "assistant" as const,
        content: entry.text.slice(0, 500),
      }));
      const response = await fetch("/api/stylist/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, recent_turns: recentTurns }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Stylist turn failed.");
      const result = TurnResponseSchema.safeParse(await response.json());
      if (!result.success) throw new Error("Invalid stylist response.");

      replyCount.current += 1;
      setEntries((current) => [
        ...current,
        {
          id: `reply-${replyCount.current}`,
          from: "stylist",
          text: result.data.message,
          products: result.data.products,
          appliedMemories: result.data.applied_memories,
          saveCandidate: result.data.pending_memory ?? undefined,
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
          text: "I couldn't complete that request. Nothing was confirmed as saved. Please try again.",
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
            Share what you&apos;re looking for to find matching items
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
        Your message and recent chat context are sent to OpenAI to understand your request.
        Signed-in customers can choose which style details to save. By using
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
            onProductOpen={onClose}
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
          placeholder="e.g. a black dress under $300 in size 10"
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
