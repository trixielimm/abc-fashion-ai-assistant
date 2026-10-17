"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronIcon } from "@/components/ui/icons";
import { addToCart } from "@/lib/cart";
import { automaticCartSize } from "@/lib/stylist/productActions";
import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { ChatProduct } from "@/lib/stylist/conversationProtocol";
import styles from "./ShoppingConversation.module.css";

export type ShoppingAction = "cross_sell" | "cheaper" | "upsell" | "keep" | "own" | "remove" | "reject";
type DisplayProduct = ChatProduct & { differences?: string[] };
const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const money = (value: number) => `A$${value.toFixed(2)}`;
const featureValue = (value: boolean | number | string[], key: string) => typeof value === "boolean"
  ? value ? "Yes" : "No" : Array.isArray(value) ? value.join(", ") : `${value}${key === "capacity_litres" ? " L" : ""}`;

function extraLabel(target: string) {
  if (norm(target) === "bags") return "Style with a bag";
  return `Style with ${target.toLowerCase()}`;
}

function ProductCard({ product, preferences, featured, onOpen, onAction, selectedIds, onEvent, position, allowOffers = true }: {
  product: DisplayProduct;
  preferences: ShoppingPreferences | null;
  featured: boolean;
  onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
  selectedIds?: readonly string[];
  onEvent?: (type: "select" | "own" | "reject" | "add_to_cart", productId: string, position: number) => void;
  position: number;
  allowOffers?: boolean;
}) {
  const sizes = product.sizes_available;
  const automatic = automaticCartSize(sizes);
  const known = preferences?.category === product.category && preferences?.size
    ? sizes.find(value => norm(value) === norm(preferences.size!)) ?? "" : "";
  const initialSize = automatic ?? known;
  const [size, setSize] = useState(initialSize);
  const [choosing, setChoosing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const sizeInput = useRef<HTMLSelectElement>(null);
  const image = product.image_src ?? null;
  const showImage = image !== null && failedImage !== image;

  function add() {
    if (!size || !sizes.includes(size)) {
      setChoosing(true);
      setFeedback("Choose the size you want to add.");
      window.requestAnimationFrame(() => sizeInput.current?.focus());
      return;
    }
    try {
      addToCart({
        productId: product.product_id, name: product.product_name,
        price: product.price_aud, category: product.category,
        size, quantity: 1, image: showImage ? image : null,
      });
      onEvent?.("add_to_cart", product.product_id, position);
      setChoosing(false);
      setFeedback("Added to cart. Other items in your cart are unchanged.");
    } catch {
      setFeedback("I couldn't update the cart. Please try again.");
    }
  }

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""}`}>
      <div className={styles.cardLayout}>
        <Link className={`${styles.imageLink} ${!showImage ? styles.imageMissing : ""}`} href={`/products/${encodeURIComponent(product.product_id)}`}
          onClick={onOpen} aria-label={`View ${product.product_name}`}>
          {showImage ? (
            <Image src={image} alt={product.product_name} fill unoptimized
              sizes={featured ? "(max-width: 600px) 35vw, 220px" : "260px"}
              className={styles.productImage} onError={() => setFailedImage(image)} />
          ) : (
            <span className={styles.imagePlaceholder}>
              <span aria-hidden="true" className={styles.placeholderMark}>ABC</span>
              <span>Photo unavailable</span>
            </span>
          )}
        </Link>
        <div className={styles.productInfo}>
          <Link className={styles.productName} href={`/products/${encodeURIComponent(product.product_id)}`} onClick={onOpen}>
            {product.product_name}
          </Link>
          {product.brand_line ? <p className={styles.brand}>{product.brand_line}</p> : null}
          <p className={styles.price}>{money(product.price_aud)}</p>
          {product.colour ? <p className={styles.colour}>Colour: {product.colour}</p> : null}
          {product.differences?.length ? (
            <div className={styles.differences}>
              <strong>Alternative — details differ</strong>
              <ul>{product.differences.map(detail => <li key={detail}>{detail}</li>)}</ul>
            </div>
          ) : null}
          {product.explanation ? <p className={styles.explanation}>{product.explanation}</p> : null}
          {product.pairing_evidence ? <details className={styles.messageDetails}>
            <summary>Why this pairing?</summary>
            <p>{product.pairing_evidence.reasons.join(" ")}</p>
            {product.pairing_evidence.limitations.length ? <p>{product.pairing_evidence.limitations.join(" ")}</p> : null}
            <p>Based on recorded attributes and styling suggestions. Visual compatibility has not been verified.</p>
          </details> : null}
          {product.value_comparison ? <details className={styles.messageDetails}>
            <summary>{product.value_comparison.kind === "upgrade" ? "What the extra cost gives you" : "Benefit and price comparison"}</summary>
            <p>Original: {money(product.value_comparison.primary_price_aud)}. This option: {money(product.price_aud)}.</p>
            {product.value_comparison.benefits.map(benefit => <p key={benefit.feature_key}>
              {benefit.label}. Original: {featureValue(benefit.before, benefit.feature_key)}. This option: {featureValue(benefit.after, benefit.feature_key)}.<br />
              {benefit.evidence_kind === "synthetic" ? "Source: prototype product specifications." : `Evidence: ${benefit.source_references.join("; ")}`}
            </p>)}
            {product.value_comparison.context_benefits.map(benefit => <p key={benefit}>{benefit}</p>)}
            {product.value_comparison.tradeoffs.map(tradeoff => <p key={tradeoff}>{tradeoff}</p>)}
          </details> : null}
          <div className={styles.cartArea}>
            {choosing ? (
              <label className={styles.sizeLabel}>
                Size for this item
                <select ref={sizeInput} value={size} className={styles.sizeSelect}
                  onChange={event => { setSize(event.target.value); setFeedback(""); }}>
                  <option value="">Choose size</option>
                  {sizes.map(label => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>
            ) : known ? <p className={styles.knownSize}>Selected size: {known}</p> : null}
            <button type="button" onClick={add} className={styles.addButton}>
              {choosing ? "Confirm add" : "Add to cart"}
            </button>
            {choosing ? <button type="button" className={styles.textButton} onClick={() => {
              setChoosing(false); setSize(initialSize); setFeedback("");
            }}>Cancel size selection</button> : null}
          </div>
          {feedback ? <p role="status" className={styles.feedback}>{feedback}</p> : null}
          {onAction && allowOffers && product.extra_target ? (
            <button type="button" className={styles.lookAction} onClick={() => onAction("cross_sell", product)}>
              {extraLabel(product.extra_target)}<ChevronIcon direction="right" />
            </button>
          ) : null}
          {onAction ? <div className={styles.outfitCardActions}>
            <button type="button" className={styles.textButton} onClick={() => {
              const kept = selectedIds?.includes(product.product_id);
              if (!kept) onEvent?.("select", product.product_id, position);
              onAction(kept ? "remove" : "keep", product);
            }}>{selectedIds?.includes(product.product_id) ? "Remove from outfit" : "Keep for my outfit"}</button>
            <button type="button" className={styles.textButton} onClick={() => { onEvent?.("own", product.product_id, position); onAction("own", product); }}>I already own this</button>
            {allowOffers ? <button type="button" className={styles.textButton} onClick={() => onAction("upsell", product)}>Compare value</button> : null}
            <button type="button" className={styles.textButton} onClick={() => { onEvent?.("reject", product.product_id, position); onAction("reject", product); }}>Skip this item</button>
          </div> : null}
        </div>
      </div>
    </article>
  );
}

export function ShoppingProductResults({ products, preferences, label, onOpen, onAction, selectedIds, onEvent, allowOffers = true, positionOffset = 0 }: {
  products: DisplayProduct[];
  preferences: ShoppingPreferences | null;
  label: string;
  onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
  selectedIds?: readonly string[];
  onEvent?: (type: "select" | "own" | "reject" | "add_to_cart", productId: string, position: number) => void;
  allowOffers?: boolean;
  positionOffset?: number;
}) {
  const row = useRef<HTMLDivElement>(null);
  const id = useId();
  const featured = products.length === 1;
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = row.current;
    if (!element || featured) return;
    function updateEdges() {
      if (!element) return;
      const start = element.scrollLeft <= 2;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    }
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", updateEdges);
    };
  }, [featured, products]);
  function scroll(direction: number) {
    const element = row.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: reduced ? "auto" : "smooth" });
  }
  if (!products.length) return null;
  return (
    <section className={styles.results} aria-label={label}>
      {!featured ? (
        <div className={styles.rowToolbar}>
          <span>{products.length} pieces<span className={styles.swipeHint}> · Swipe to explore</span></span>
          {!(edges.start && edges.end) ? <div className={styles.rowArrows}>
            <button type="button" aria-label="Previous products" aria-controls={id} disabled={edges.start} onClick={() => scroll(-1)}><ChevronIcon /></button>
            <button type="button" aria-label="Next products" aria-controls={id} disabled={edges.end} onClick={() => scroll(1)}><ChevronIcon direction="right" /></button>
          </div> : null}
        </div>
      ) : null}
      <div id={id} ref={row} tabIndex={featured ? undefined : 0} role="list"
        aria-label={label} className={featured ? styles.singleResult : styles.productRow}>
        {products.map((product, index) => (
          <div role="listitem" key={product.product_id} className={featured ? styles.featureItem : styles.rowItem}>
            <ProductCard product={product} preferences={preferences} featured={featured} onOpen={onOpen} onAction={onAction}
              selectedIds={selectedIds} onEvent={onEvent} position={positionOffset + index + 1} allowOffers={allowOffers} />
          </div>
        ))}
      </div>
    </section>
  );
}
