"use client";

import {
  FollowUpKindSchema,
  type FollowUpKind,
} from "@/lib/ai/resolveFollowUp";
import {
  ChatRequestError,
  postChatJson,
} from "@/lib/ai/chatRequest";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  automaticCartSize,
  prepareProductAction,
  ProductActionInputError,
  type ProductAction,
  type ProductActionKind,
} from "@/lib/stylist/productActions";

import { CloseIcon, PersonIcon } from "@/components/ui/icons";
import {
  chooseCheaperContext,
  preferencesForViewedProduct,
  type ViewedPageContext,
} from "@/lib/stylist/viewedProduct";
import {
  isCheaperMessage,
  rememberPriceContext,
  type PriceContext,
} from "@/lib/stylist/priceContext";
import { ProductVisual } from "@/components/commerce/ProductVisual";
import { cn } from "@/lib/cn";
import { addToCart } from "@/lib/cart";
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
  image_key: z.string().nullable().optional(),
  sizes_available: z.array(z.string().min(1)).min(1),
  explanation: z.string().optional(),
});

const StylistSearchResponseSchema = z.object({
  status: z.enum(["matches", "partial", "no_match", "needs_more_detail"]),
  message: z.string(),
  products: z.array(StylistProductSchema).max(4),
});

const ExtractionResponseSchema = z.object({
  preferences: ShoppingPreferencesSchema,
  issues: z.array(z.object({
    field: z.string(),
    value: z.union([z.string(), z.number()]),
    code: z.enum(["unsupported_value", "category_mismatch", "invalid_budget"]),
    blocking: z.boolean(),
  })),
  needs_clarification: z.boolean(),
  follow_up_question: z
  .object({
    kind: FollowUpKindSchema,
    message: z.string().min(1),
  })
  .nullable()
  .optional(),
});

type PreferenceIssue = z.infer<typeof ExtractionResponseSchema>["issues"][number];

function describeIssue(issue: PreferenceIssue): string {
  if (issue.code === "invalid_budget") {
    return "Your minimum price is higher than your maximum price. Please check your budget.";
  }
  if (issue.code === "category_mismatch") {
    return `The ${issue.value} subcategory does not match the selected category. Please clarify which you want.`;
  }
  const field = issue.field.replaceAll("_", " ");
  return issue.blocking
    ? `I couldn't find ${issue.value} as a catalogue ${field}. Please choose another ${field}.`
    : `I couldn't find an exact catalogue label for ${issue.value} (${field}). I have kept this preference, but available results may not match it.`;
}

type StylistProduct = z.infer<typeof StylistProductSchema>;

type Entry = {
  id: string;
  from: "stylist" | "you";
  text: string;
  preferences?: ShoppingPreferences;
  issues?: PreferenceIssue[];
  products?: StylistProduct[];
  crossSellPreferences?: ShoppingPreferences;
};
type ChatAttempt =
  | {
      stage: "extraction";
      message: string;
      currentPreferences: ShoppingPreferences | null;
      pendingFollowUp: FollowUpKind | null;
    }
  | {
      stage: "search";
      preferences: ShoppingPreferences;
      cheaperThan?: PriceContext["references"];
    }
  | {
      stage: "product_action";
      action: ProductAction;
    };
const GREETING =
  "Welcome to ABC Fashion. Tell me what you're shopping for, and I'll find a few items that fit your preferences.";

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

function PreferenceDetails({ preferences, issues = [] }: { preferences: ShoppingPreferences; issues?: PreferenceIssue[] }) {
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
      {issues.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-hairline pt-3 text-[12px]">
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>{describeIssue(issue)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RecommendationCard({
  product,
  onProductOpen,
  preferences,
}: {
  product: StylistProduct;
  onProductOpen: () => void;
  preferences?: ShoppingPreferences;
}) {
  const sizes = product.sizes_available;
  const automaticSize = automaticCartSize(sizes);

const knownSize =
  preferences?.category &&
  preferences.category === product.category &&
  preferences.size
    ? sizes.find(
        (label) =>
          label.trim().toLowerCase() ===
          preferences.size!.trim().toLowerCase()
      ) ?? ""
    : "";

const [selectedSize, setSelectedSize] = useState(
  automaticSize ?? knownSize
);

const [choosingSize, setChoosingSize] = useState(false);
  const [feedback, setFeedback] = useState("");

  function addProduct() {
    if (!selectedSize || !sizes.includes(selectedSize)) {
  setChoosingSize(true);
  setFeedback("Choose a size to add this item to your cart.");
  return;
}

    try {
      addToCart({
        productId: product.product_id,
        size: selectedSize,
        quantity: 1,
        name: product.product_name,
        price: product.price_aud,
        image: getProductImageSrc(product.product_id, product.image_key),
        category: product.category,
      });
      setChoosingSize(false);
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
        <ProductImage
          src={getProductImageSrc(product.product_id, product.image_key)}
          name={product.product_name}
          category={product.subcategory ?? product.category}
          sizes="(max-width: 640px) 72px, 88px"
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
        {product.explanation ? (
  <p className="mt-2 text-[11px] leading-5 text-muted">
    {product.explanation}
  </p>
) : null}

<div className="mt-3 flex flex-wrap gap-2">
  {choosingSize ? (
    <label className="min-w-[90px] flex-1">
      <span className="sr-only">
        Size for {product.product_name}
      </span>

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
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  ) : null}

  <button
    type="button"
    onClick={addProduct}
    className="min-h-9 min-w-[105px] flex-1 bg-foreground px-3 text-[10px] font-medium tracking-[0.08em] text-background uppercase transition-opacity hover:opacity-80"
  >
    {choosingSize ? "Confirm add" : "Add to cart"}
  </button>

  {choosingSize ? (
    <button
      type="button"
      onClick={() => {
        setChoosingSize(false);
        setSelectedSize(automaticSize ?? knownSize);
        setFeedback("");
      }}
      className="text-[11px] underline"
    >
      Cancel
    </button>
  ) : null}
</div>
        {feedback ? <p role="status" className="mt-2 text-[11px]">{feedback}</p> : null}
      </div>
    </article>
  );
}

function ProductRecommendations({
  products,
  onProductOpen,
  onAction,
  preferences,
}: {
  products: StylistProduct[];
  preferences?: ShoppingPreferences;
  onProductOpen: () => void;
  onAction?: (
    kind: ProductActionKind,
    product: StylistProduct
  ) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-hairline pt-4 lg:grid-cols-2">
      {products.map((product) => (
        <div key={product.product_id}>
          <RecommendationCard
            product={product}
            onProductOpen={onProductOpen}
            preferences={preferences}
          />

          {onAction ? (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => onAction("cross_sell", product)}
                className="underline underline-offset-2"
              >
                Find an extra
              </button>

              <button
                type="button"
                onClick={() => onAction("upsell", product)}
                className="underline underline-offset-2"
              >
                Compare higher-priced options
              </button>
            </div>
          ) : null}
        </div>
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
  showUpsell = false,
  onProductAction,
}: {
  entry: Entry;
  live?: boolean;
  onTick?: () => void;
  onTyped?: () => void;
  onProductOpen: () => void;
  showUpsell?: boolean;
  onProductAction: (
    kind: ProductActionKind,
    product: StylistProduct,
    preferences: ShoppingPreferences
  ) => void;
}) {
  const context = entry.crossSellPreferences;
  const isYou = entry.from === "you";

  return (
    <div className={cn("flex gap-4", isYou && "flex-row-reverse")}>
      <Avatar from={entry.from} />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isYou ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "flex items-baseline gap-2",
            isYou && "flex-row-reverse"
          )}
        >
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
            {isYou ? "You" : "AI Stylist"}
          </p>
          <p className="text-[10px] text-muted">Just now</p>
        </div>

        <div
          className={cn(
            "mt-2 max-w-full border p-3 text-[14px] leading-6 [overflow-wrap:anywhere] sm:p-4",
            !entry.products?.length && "sm:max-w-[74%]",
            isYou
              ? "border-foreground bg-foreground text-background"
              : "border-hairline bg-surface"
          )}
        >
          {entry.preferences ? (
            <PreferenceDetails
              preferences={entry.preferences}
              issues={entry.issues}
            />
          ) : entry.products?.length ? (
            <div>
              <p>{entry.text}</p>

              <ProductRecommendations
                products={entry.products}
                preferences={context}
                onProductOpen={onProductOpen}
                onAction={
                  showUpsell && context
                    ? (kind, product) =>
                        onProductAction(kind, product, context)
                    : undefined
                }
              />
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
        </div>
      </div>
    </div>
  );
}

export function StylistChat({
  onClose,
  onReset,
  viewedPage = null,
}: {
  onClose: () => void;
  onReset: () => void;
  viewedPage?: ViewedPageContext | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<Entry | null>(null);
  const [thinking, setThinking] = useState(true);
  const [draft, setDraft] = useState("");
  const [retryAttempt, setRetryAttempt] =
  useState<ChatAttempt | null>(null);
  const [tick, setTick] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const replyCount = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const currentPreferencesRef = useRef<ShoppingPreferences | null>(null);
  const consumedPageKeyRef = useRef<number | null>(null);
  const activePriceContextRef = useRef<PriceContext | null>(null);
  const pendingFollowUpRef = useRef<FollowUpKind | null>(null);
  const busy = thinking || pending !== null;

  useEffect(() => () => {
  requestRef.current?.abort();
  requestRef.current = null;
}, []);

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

  async function runChatAttempt(attempt: ChatAttempt) {
  if (requestRef.current !== null) return;

  const controller = new AbortController();
  requestRef.current = controller;

  setThinking(true);
  setRetryAttempt(null);
  activePriceContextRef.current = null;

  // After extraction succeeds, retry search rather than extraction.
  let failedAttempt: ChatAttempt = attempt;

  function isCurrent() {
    return (
      requestRef.current === controller &&
      !controller.signal.aborted
    );
  }

  try {
    if (attempt.stage === "product_action") {
  const prepared = prepareProductAction(attempt.action);

  const data = await postChatJson(
    prepared.endpoint,
    prepared.body,
    { signal: controller.signal }
  );

  if (!isCurrent()) return;

  const result = prepared.read(data);

  const context =
    result.preferences ?? attempt.action.preferences;
    activePriceContextRef.current = rememberPriceContext(
  result.products,
  context
);

  if (result.preferences !== null) {
    currentPreferencesRef.current =
      ShoppingPreferencesSchema.parse(result.preferences);
  }

  pendingFollowUpRef.current = null;

  replyCount.current += 1;
  const id = `action-result-${replyCount.current}`;

  setEntries((current) => [
    ...current,
    {
      id,
      from: "stylist",
      text: result.message,
      products: result.products,
      crossSellPreferences:
        ShoppingPreferencesSchema.parse(context),
    },
  ]);

  return;
}
    let preferences: ShoppingPreferences;

    if (attempt.stage === "search") {
      preferences = ShoppingPreferencesSchema.parse(
        attempt.preferences
      );
    } else {
      const data = await postChatJson(
        "/api/extraction",
        {
          message: attempt.message,

          ...(attempt.currentPreferences
            ? {
                current_preferences:
                  attempt.currentPreferences,
              }
            : {}),

          ...(attempt.pendingFollowUp
            ? {
                pending_follow_up:
                  attempt.pendingFollowUp,
              }
            : {}),
        },
        { signal: controller.signal }
      );

      if (!isCurrent()) return;

      const parsed = ExtractionResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error("Invalid preference response.");
      }

      preferences = parsed.data.preferences;
      currentPreferencesRef.current = preferences;

      const question = parsed.data.follow_up_question ?? null;
      pendingFollowUpRef.current = question?.kind ?? null;

      replyCount.current += 1;
      const preferenceEntryId =
        `preferences-${replyCount.current}`;

      setEntries((current) => [
        ...current,
        {
          id: preferenceEntryId,
          from: "stylist",
          text: "",
          preferences,
          issues: parsed.data.issues,
        },
      ]);

      if (question) {
        replyCount.current += 1;
        const questionId =
          `clarification-${replyCount.current}`;

        setEntries((current) => [
          ...current,
          {
            id: questionId,
            from: "stylist",
            text: question.message,
          },
        ]);

        return;
      }

      if (parsed.data.needs_clarification) return;
    }

   const cheaperThan =
  attempt.stage === "search"
    ? attempt.cheaperThan
    : undefined;

failedAttempt = {
  stage: "search",
  preferences: ShoppingPreferencesSchema.parse(preferences),
  cheaperThan,
};

const data = await postChatJson(
  "/api/stylist-search",
  {
    preferences,
    ...(cheaperThan ? { cheaper_than: cheaperThan } : {}),
  },
  { signal: controller.signal }
);

    if (!isCurrent()) return;

    const search = StylistSearchResponseSchema.safeParse(data);

    if (!search.success) {
      throw new Error("Invalid search response.");
    }

    const hasMatches =
      search.data.status === "matches" ||
      search.data.status === "partial";

    if (hasMatches !== (search.data.products.length > 0)) {
      throw new Error(
        "Search status and product list disagree."
      );
    }

    replyCount.current += 1;
    const productEntryId = `products-${replyCount.current}`;
    currentPreferencesRef.current =
  ShoppingPreferencesSchema.parse(preferences);
    activePriceContextRef.current = rememberPriceContext(
  search.data.products,
  preferences
);

    setEntries((current) => [
      ...current,
      {
        id: productEntryId,
        from: "stylist",
        text: search.data.message,
        products: search.data.products,
        crossSellPreferences:
          ShoppingPreferencesSchema.parse(preferences),
      },
    ]);
  } catch (error) {
    if (!isCurrent()) return;

    const invalidAction = error instanceof ProductActionInputError;

if (!invalidAction) {
  setRetryAttempt(failedAttempt);
}

    const timedOut =
      error instanceof ChatRequestError &&
      error.kind === "timeout";

   const step =
  failedAttempt.stage === "product_action"
    ? "finding options for that product"
    : failedAttempt.stage === "search"
      ? "searching the catalogue"
      : "reading your request";

    const message = invalidAction
  ? error.message
  : timedOut
      ? `The request timed out while ${step}. No new products were returned. Use Retry failed step or send a new message.`
      : `I couldn't finish ${step}. This is a technical failure, not a no-match result. Use Retry failed step or send a new message.`;

    replyCount.current += 1;
    const errorId = `error-${replyCount.current}`;

    setEntries((current) => [
      ...current,
      {
        id: errorId,
        from: "stylist",
        text: message,
      },
    ]);
  } finally {
    if (requestRef.current === controller) {
      requestRef.current = null;
      setThinking(false);
    }
  }
}

async function extract(message: string) {
  if (isCheaperMessage(message)) {
    const chosen = chooseCheaperContext(
  activePriceContextRef.current,
  viewedPage,
  consumedPageKeyRef.current,
  currentPreferencesRef.current
);

consumedPageKeyRef.current = chosen.pageKey;
const context = chosen.context;

    setRetryAttempt(null);
    pendingFollowUpRef.current = null;

    if (!context) {
      replyCount.current += 1;
      const id = `price-context-${replyCount.current}`;

      setEntries((current) => [
        ...current,
        {
          id,
          from: "stylist",
          text:
            "I need a recent product result to compare prices. Tell me what item you are looking for, or run the main search again.",
        },
      ]);

      return;
    }

    await runChatAttempt({
      stage: "search",
      preferences: ShoppingPreferencesSchema.parse(
        context.preferences
      ),
      cheaperThan: context.references,
    });

    return;
  }
consumedPageKeyRef.current = viewedPage?.key ?? null;
  await runChatAttempt({
    stage: "extraction",
    message,
    currentPreferences: currentPreferencesRef.current
      ? ShoppingPreferencesSchema.parse(
          currentPreferencesRef.current
        )
      : null,
    pendingFollowUp: pendingFollowUpRef.current,
  });
}
function compareViewedProduct() {
  if (
    !viewedPage ||
    busy ||
    requestRef.current !== null
  ) {
    return;
  }

  const context = rememberPriceContext(
    [viewedPage.product],
    preferencesForViewedProduct(
      viewedPage.product,
      currentPreferencesRef.current
    )
  );

  if (!context) return;

  consumedPageKeyRef.current = viewedPage.key;

  replyCount.current += 1;
  const id = `page-comparison-${replyCount.current}`;

  setEntries((current) => [
    ...current,
    {
      id,
      from: "you",
      text:
        `Find cheaper alternatives to ${viewedPage.product.product_name}.`,
    },
  ]);

  void runChatAttempt({
    stage: "search",
    preferences: context.preferences,
    cheaperThan: context.references,
  });
}

function startProductAction(
  kind: ProductActionKind,
  product: StylistProduct,
  preferences: ShoppingPreferences
) {
  if (busy || requestRef.current !== null) return;
  consumedPageKeyRef.current = viewedPage?.key ?? null;

  const action: ProductAction = {
    kind,
    product: StylistProductSchema.parse(product),
    preferences: ShoppingPreferencesSchema.parse(preferences),
  };

  const text =
    kind === "cross_sell"
      ? `Find an optional extra for ${product.product_name}.`
      : `Compare higher-priced alternatives to ${product.product_name}.`;

  replyCount.current += 1;
  const id = `action-request-${replyCount.current}`;

  setEntries((current) => [
    ...current,
    { id, from: "you", text },
  ]);

  void runChatAttempt({
    stage: "product_action",
    action,
  });
}
  function send() {
    const message = draft.trim();
    if (!message || busy || requestRef.current !== null) return;

    setEntries((current) => [
      ...current,
      { id: `you-${current.length}`, from: "you", text: message },
    ]);
    setDraft("");
    void extract(message);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-surface px-4 py-3 sm:items-start sm:px-6 sm:py-5">
        <span
          aria-hidden
          className="mt-[3px] hidden h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-foreground sm:flex"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-serif text-[15px] tracking-[0.16em] uppercase">
              AI Stylist
            </p>
            <span className="hidden border border-hairline bg-panel px-2 py-1 text-[9px] tracking-[0.14em] uppercase sm:inline">
              ABC Concierge
            </span>
          </div>
          <p className="mt-1 hidden text-[12px] text-muted sm:block">
            Share what you&apos;re looking for to find matching items
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
  requestRef.current?.abort();
  currentPreferencesRef.current = null;
  pendingFollowUpRef.current = null;
 activePriceContextRef.current = null;
  onReset();
}}
            aria-label="Reset chat"
            className="min-h-11 border border-hairline bg-panel px-3 py-2 text-[11px] font-medium tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stylist"
            className="flex h-11 w-11 items-center justify-center border border-hairline bg-panel transition-opacity hover:opacity-60"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <aside
        aria-label="AI Stylist terms notice"
        className="max-h-[25%] shrink-0 overflow-y-auto border-b border-hairline bg-background px-4 py-2 text-[11px] leading-5 text-muted sm:px-8 sm:py-3"
      >
        Your message and current shopping preferences are sent to OpenAI to
        update your preferences. By using this stylist, you agree to the{" "}
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
{viewedPage ? (
  <aside
    aria-label="Current product page context"
    className="shrink-0 border-b border-hairline bg-background px-6 py-3 text-[12px]"
  >
    <p>
      Page product:{" "}
      <strong>{viewedPage.product.product_name}</strong>
      {" · "}
      {formatPrice(viewedPage.product.price_aud)}
    </p>

    <p className="mt-1 text-[11px] text-muted">
      Existing limits and exclusions stay in place.
      A saved size is reused only within the same category.
    </p>

    <div className="mt-2 flex flex-wrap gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={compareViewedProduct}
        className="underline underline-offset-2 disabled:opacity-50"
      >
        Cheaper alternatives to this item
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          startProductAction(
            "cross_sell",
            viewedPage.product,
            preferencesForViewedProduct(
              viewedPage.product,
              currentPreferencesRef.current
            )
          )
        }
        className="underline underline-offset-2 disabled:opacity-50"
      >
        Find an extra for this item
      </button>
    </div>
  </aside>
) : null}
      <div
        ref={transcriptRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={busy}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-panel px-4 py-5 sm:px-8 sm:py-6"
      >
        {[...entries, ...(pending ? [pending] : [])].map((entry) => (
          <Message
            key={entry.id}
            entry={entry}
            onProductAction={startProductAction}
            showUpsell={
  !busy && entry.id === entries[entries.length - 1]?.id
}
            live={pending?.id === entry.id}
            onTick={() => setTick((value) => value + 1)}
            onTyped={() => commitPending(entry)}
            onProductOpen={onClose}
          />
        ))}
        {thinking ? <TypingDots /> : null}
      </div>
{retryAttempt ? (
  <div className="shrink-0 border-t border-hairline bg-background px-6 py-3 text-[12px]">
    <p className="text-muted">
      {retryAttempt.stage === "product_action"
  ? "Retry the same product action without changing its preferences."
  : retryAttempt.stage === "search"
    ? "Your preferences were saved. Retry only the product search."
    : "Retry the message using the same earlier shopping context."}
    </p>

    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (retryAttempt) {
          void runChatAttempt(retryAttempt);
        }
      }}
      className="mt-2 border border-hairline px-3 py-2 disabled:opacity-50"
    >
      Retry failed step
    </button>
  </div>
) : null}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline bg-panel px-6 py-2.5">
        <span className="shrink-0 text-[10px] tracking-[0.14em] text-muted uppercase">
          Suggestions:
        </span>
        {stylistSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setDraft(suggestion)}
            className="min-h-11 shrink-0 border border-hairline bg-surface px-3 py-2 text-[11px] tracking-[0.08em] uppercase transition-opacity hover:opacity-60"
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
        className="flex shrink-0 items-center gap-2 border-t border-hairline bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-5 sm:py-5"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          aria-label="Message your stylist"
          placeholder={`e.g. ${stylistSuggestions[0].toLowerCase()}`}
          className="h-[46px] min-w-0 flex-1 border border-hairline bg-panel px-3 text-base outline-none placeholder:text-muted focus:border-foreground sm:px-4 sm:text-sm"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-[46px] shrink-0 items-center gap-2 bg-foreground px-4 text-[11px] font-medium tracking-[0.16em] text-background uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 sm:px-6"
        >
          Send ↑
        </button>
      </form>
    </div>
  );
}
