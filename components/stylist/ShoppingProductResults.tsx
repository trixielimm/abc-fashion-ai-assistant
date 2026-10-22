"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronIcon } from "@/components/ui/icons";
import { addToCart } from "@/lib/cart";
import { formatAud } from "@/lib/format-price";
import productImageLoader from "@/lib/product-image-loader";
import { automaticCartSize } from "@/lib/stylist/productActions";
import { preferredCardSize, productCardReason } from "@/lib/stylist/productCardPresentation";
import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { ChatProduct } from "@/lib/stylist/conversationProtocol";
import { outfitProductNote } from "@/lib/stylist/outfitPresentation";
import styles from "./ShoppingConversation.module.css";

export type ShoppingAction = "cross_sell" | "cheaper" | "upsell" | "keep" | "own" | "remove" | "reject";
type DisplayProduct = ChatProduct & { differences?: string[] };
type ProductEvent = (type: "select" | "own" | "reject" | "add_to_cart", productId: string, position: number) => void;
const featureValue = (value: boolean | number | string[], key: string) => typeof value === "boolean"
  ? value ? "Yes" : "No" : Array.isArray(value) ? value.join(", ") : `${value}${key === "capacity_litres" ? " L" : ""}`;

function ProductCautions({ product, outfitMode }: { product: DisplayProduct; outfitMode: boolean }) {
  const note = outfitMode ? outfitProductNote(product) : null;
  const comparison = product.value_comparison;
  if (!note && !product.differences?.length && !product.pairing_evidence && !comparison && !product.unverified_requirements?.length) return null;
  return <div className={styles.cardCautions}>
    {product.unverified_requirements?.map(requirement => <p key={requirement}>{outfitMode ? "Outfit requirement unverified" : "Unverified"}: {requirement}.</p>)}
    {note ? <p>{note}</p> : null}
    {product.differences?.length ? <div className={styles.differences}>
      <strong>Alternative: details differ</strong>
      <ul>{product.differences.map(detail => <li key={detail}>{detail}</li>)}</ul>
    </div> : null}
    {product.pairing_evidence ? <>
      {product.pairing_evidence.limitations.map(limit => <p key={limit}>{limit}</p>)}
      <p>Pairing uses recorded attributes; visual compatibility is unverified.</p>
    </> : null}
    {comparison ? <>
      <p>{comparison.extra_cost_aud > 0 ? `${formatAud(comparison.extra_cost_aud)} more` : comparison.extra_cost_aud < 0
        ? `${formatAud(-comparison.extra_cost_aud)} less` : "Same price"} than the original ({formatAud(comparison.primary_price_aud)}).</p>
      {comparison.tradeoffs.map(tradeoff => <p key={tradeoff}>{tradeoff}</p>)}
      {comparison.benefits.some(benefit => benefit.evidence_kind === "synthetic") ? <p>Benefits use prototype product specifications.</p> : null}
    </> : null}
  </div>;
}

function ProductCard({ product, preferences, featured, onOpen, onAction, onSimilar, selectedIds, onEvent, position, allowOffers = true, outfitMode = false, actionDisabled = false, recommended = false, open = true }: {
  product: DisplayProduct; preferences: ShoppingPreferences | null; featured: boolean; onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
  onSimilar?: (product: ChatProduct) => void; selectedIds?: readonly string[]; onEvent?: ProductEvent;
  position: number; allowOffers?: boolean; outfitMode?: boolean; actionDisabled?: boolean; recommended?: boolean; open?: boolean;
}) {
  const id = useId();
  const sizes = product.sizes_available;
  const automatic = automaticCartSize(sizes);
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const size = chosenSize === null ? preferredCardSize(product, preferences) : sizes.includes(chosenSize) ? chosenSize : "";
  const [feedback, setFeedback] = useState("");
  const [addedSize, setAddedSize] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [choosingSize, setChoosingSize] = useState(false);
  const sizeInput = useRef<HTMLSelectElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const image = product.image_src ?? null;
  const showImage = image !== null && failedImage !== image;
  const selected = selectedIds?.includes(product.product_id) ?? false;
  const added = Boolean(size && addedSize === size);
  const reason = productCardReason(product, preferences);
  const href = `/products/${encodeURIComponent(product.product_id)}`;

  useEffect(() => {
    if (!open || actionDisabled) options.current?.hidePopover();
  }, [open, actionDisabled]);

  function chooseSize() {
    setChoosingSize(true);
    window.requestAnimationFrame(() => sizeInput.current?.focus());
  }
  function visitProduct() { onOpen(); }
  function closeOptions() { options.current?.hidePopover(); optionsTrigger.current?.focus(); }
  function selectForOutfit() {
    if (!onAction || actionDisabled) return;
    if (!selected) onEvent?.("select", product.product_id, position);
    onAction(selected ? "remove" : "keep", product);
  }
  function add() {
    if (actionDisabled) return;
    if (!size || !sizes.includes(size)) { setFeedback("Choose a size to add this item."); chooseSize(); return; }
    try {
      addToCart({ productId: product.product_id, name: product.product_name, price: product.price_aud,
        category: product.category, size, quantity: 1, image: showImage ? image : null });
      onEvent?.("add_to_cart", product.product_id, position);
      setAddedSize(size);
      setChoosingSize(false);
      setFeedback(`Added · ${automatic ? size : `Size ${size}`}`);
    } catch { setFeedback("Couldn't update your cart. Please try again."); }
  }
  function productImage() {
    return showImage ? <Image src={image} alt={product.product_name} fill
      loader={image.startsWith("/api/products/") ? productImageLoader : undefined}
      sizes="(max-width: 639px) 104px, 232px"
      className={styles.productImage}
      onError={() => setFailedImage(image)} /> :
      <span className={styles.imagePlaceholder}><span aria-hidden="true" className={styles.placeholderMark}>ABC</span><span>Photo unavailable</span></span>;
  }
  function outfitButton() {
    if (!onAction) return null;
    return <button type="button" className={styles.cardSecondary}
      aria-pressed={selected} disabled={actionDisabled}
      aria-label={`${selected ? "Remove from your look" : "Save to look"}: ${product.product_name}`}
      onClick={selectForOutfit}>{selected ? <><CheckIcon /> Saved</> : "Save to look"}</button>;
  }
  function cartButton() {
    return <button type="button" className={`${styles.cardPrimary} ${added && !actionDisabled ? styles.cardAdded : ""}`} disabled={actionDisabled || added}
      aria-label={added ? `${product.product_name} added to cart` : undefined}
      onClick={size ? add : () => chooseSize()}>
      {added ? <><CheckIcon /> Added</> : "Add to cart"}
    </button>;
  }
  function cartFeedback() {
    return feedback ? <div className={styles.cardFeedback}>
      <p role="status">{feedback}</p>
      {added ? <Link href="/cart" onClick={visitProduct}>View cart</Link> : null}
    </div> : null;
  }

  return <article className={`${styles.card} ${featured ? styles.featured : ""} ${selected ? styles.cardSelected : ""}`}>
    <div className={styles.cardLayout}>
      <div className={styles.imageFrame}>
        <Link className={styles.imageLink} href={href} onClick={visitProduct} aria-label={`View ${product.product_name}`}>{productImage()}</Link>
      </div>
      <div className={styles.productDetails}>
        {outfitMode ? <div className={styles.recommendationSlot}>{recommended ? <p className={styles.recommendedBadge}>Suggested pairing</p> : null}</div> : null}
        <div className={styles.productIdentity}>
          <Link className={styles.productName} href={href} onClick={visitProduct} title={product.product_name}>{product.product_name}</Link>
          <p className={styles.price}>{formatAud(product.price_aud)}</p>
        </div>
        <p className={styles.productMeta}>{[product.brand_line, product.colour, automatic].filter(Boolean).join(" · ")}</p>
        {reason ? <p className={styles.cardReason}>{reason}</p> : null}
        <div className={styles.cardTools}>
          {onAction || onSimilar || added ? <>
            <button type="button" ref={optionsTrigger} className={styles.moreOptions} popoverTarget={`${id}-options`}
              disabled={actionDisabled} aria-label={`More options for ${product.product_name}`} title="More options"
              onClick={() => {
                const rect = optionsTrigger.current?.getBoundingClientRect();
                if (rect && options.current) {
                  const menuHeight = options.current.children.length * 44 + 8;
                  options.current.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8))}px`;
                  options.current.style.left = `${Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208))}px`;
                }
              }}><span aria-hidden="true">···</span></button>
            <div ref={options} id={`${id}-options`} popover="auto" className={styles.cardOptions} aria-label={`Actions for ${product.product_name}`}>
              {added ? <button type="button" disabled={actionDisabled} onClick={() => { closeOptions(); add(); }}>Add another</button> : null}
              {added && !automatic ? <button type="button" disabled={actionDisabled} onClick={() => { closeOptions(); chooseSize(); }}>Change size</button> : null}
              {onSimilar ? <button type="button" disabled={actionDisabled} onClick={() => { closeOptions(); onSimilar(product); }}>More like this</button> : null}
              {onAction && allowOffers && product.extra_target ? <button type="button" disabled={actionDisabled} onClick={() => { closeOptions(); onAction("cross_sell", product); }}>
                {product.extra_target.trim().toLowerCase() === "bags" ? "Style with a bag" : `Style with ${product.extra_target.toLowerCase()}`}</button> : null}
              {onAction && selected ? <button type="button" disabled={actionDisabled} onClick={() => { closeOptions(); selectForOutfit(); }}>Remove from your look</button> : null}
              {onAction ? <button type="button" disabled={actionDisabled} onClick={() => {
                closeOptions(); onEvent?.("reject", product.product_id, position); onAction("reject", product);
              }}>Skip this item</button> : null}
            </div>
          </> : null}
        </div>
      </div>
      <ProductCautions product={product} outfitMode={outfitMode} />
      <div className={styles.cardFooter}>
        {choosingSize && !automatic ? <label className={styles.cardSizePicker}>Choose a size
          <span className={styles.sizeSelectControl}>
            <select ref={sizeInput} value={size} className={styles.sizeSelect} aria-label={`Size for ${product.product_name}`} disabled={actionDisabled}
              onChange={event => { setChosenSize(event.target.value); setFeedback(""); setAddedSize(null); }}>
              <option value="">Choose size</option>{sizes.map(label => <option key={label}>{label}</option>)}
            </select><ChevronIcon direction="right" className={styles.sizeSelectChevron} />
          </span>
        </label> : null}
        <div className={styles.productActions}>{outfitButton()}{cartButton()}</div>
        {size && !automatic && !choosingSize && !added ? <button type="button" className={styles.changeSize} disabled={actionDisabled} onClick={chooseSize}>Size {size} · Change</button> : null}
        {cartFeedback()}
      </div>
      {product.explanation && product.explanation !== reason || product.pairing_evidence || product.value_comparison ? <details className={styles.cardDetails}>
        <summary>Why this item?</summary>
        {product.explanation && product.explanation !== reason ? <p>{product.explanation}</p> : null}
        {product.pairing_evidence ? <p>{product.pairing_evidence.reasons.join(" ")}</p> : null}
        {product.value_comparison?.benefits.map(benefit => <p key={benefit.feature_key}>
          {benefit.label}. Original: {featureValue(benefit.before, benefit.feature_key)}. This option: {featureValue(benefit.after, benefit.feature_key)}.<br />
          {benefit.evidence_kind === "synthetic" ? "Source: prototype product specifications." : `Evidence: ${benefit.source_references.join("; ")}`}
        </p>)}
        {product.value_comparison?.context_benefits.map(benefit => <p key={benefit}>{benefit}</p>)}
      </details> : null}
    </div>
  </article>;
}

export function ShoppingProductResults({ products, preferences, preferencesByProduct, label, heading, onOpen, onAction, onSimilar, selectedIds, onEvent, allowOffers = true, positionOffset = 0, outfitMode = false, actionDisabled = false, recommendedIds = [], open = true }: {
  products: DisplayProduct[]; preferences: ShoppingPreferences | null; preferencesByProduct?: Record<string, ShoppingPreferences>;
  label: string; heading?: string; onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
  onSimilar?: (product: ChatProduct) => void; selectedIds?: readonly string[]; onEvent?: ProductEvent;
  allowOffers?: boolean; positionOffset?: number; outfitMode?: boolean; actionDisabled?: boolean; recommendedIds?: readonly string[]; open?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const id = useId();
  const featured = products.length === 1;
  const [edges, setEdges] = useState({ start: true, end: true, first: 1, last: products.length });
  useEffect(() => {
    const element = row.current;
    if (!element || featured) return;
    function updateEdges() {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const visible = Array.from(element.children).flatMap((child, index) => {
        const card = child.getBoundingClientRect();
        return card.right > rect.left + 4 && card.left < rect.right - 4 ? [index + 1] : [];
      });
      const startInset = Number.parseFloat(getComputedStyle(element).paddingLeft) || 0;
      const next = { start: element.scrollLeft <= startInset + 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
        first: visible[0] ?? 1, last: visible.at(-1) ?? products.length };
      setEdges(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    }
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateEdges); };
  }, [featured, products, open]);
  function scroll(direction: number) {
    const element = row.current;
    const first = element?.firstElementChild;
    if (!element || !first) return;
    const step = first.getBoundingClientRect().width + (Number.parseFloat(getComputedStyle(element).columnGap) || 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  }
  if (!products.length) return null;
  return <section className={styles.results} aria-label={label}>
    {heading || !featured ? <div className={styles.rowToolbar}>
      {heading ? <div className={styles.groupHeading}><h3>{heading}</h3><span>{products.length} {products.length === 1 ? "option" : "options"}</span></div>
        : <span>{products.length} {products.length === 1 ? "piece" : "pieces"}</span>}
      {!featured && !(edges.start && edges.end) ? <div className={styles.rowArrows}>
        <span className={styles.rowPosition}>{edges.first}–{edges.last} of {products.length}</span>
        <button type="button" aria-label="Previous products" aria-controls={id} disabled={edges.start} onClick={() => scroll(-1)}><ChevronIcon /></button>
        <button type="button" aria-label="Next products" aria-controls={id} disabled={edges.end} onClick={() => scroll(1)}><ChevronIcon direction="right" /></button>
      </div> : null}
    </div> : null}
    <div id={id} ref={row} tabIndex={featured ? undefined : 0} role="list" aria-label={label}
      className={featured ? styles.singleResult : styles.productRow}
      onKeyDown={event => {
        if (event.target === event.currentTarget && ["ArrowLeft", "ArrowRight"].includes(event.key) && row.current && row.current.scrollWidth > row.current.clientWidth) {
          event.preventDefault(); scroll(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      {products.map((product, index) => <div role="listitem" key={product.product_id} className={featured ? styles.featureItem : styles.rowItem}>
        <ProductCard product={product} preferences={preferencesByProduct?.[product.product_id] ?? preferences} featured={featured} onOpen={onOpen} onAction={onAction} onSimilar={onSimilar}
          selectedIds={selectedIds} onEvent={onEvent} position={positionOffset + index + 1} allowOffers={allowOffers} open={open}
          outfitMode={outfitMode} actionDisabled={actionDisabled} recommended={recommendedIds.includes(product.product_id)} />
      </div>)}
    </div>
  </section>;
}
