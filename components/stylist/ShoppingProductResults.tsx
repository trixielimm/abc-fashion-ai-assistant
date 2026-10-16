"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { addToCart } from "@/lib/cart";
import { automaticCartSize } from "@/lib/stylist/productActions";
import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { ChatProduct } from "@/lib/stylist/conversationProtocol";
import styles from "./ShoppingConversation.module.css";

export type ShoppingAction = "cross_sell" | "cheaper" | "upsell";
type DisplayProduct = ChatProduct & { differences?: string[] };
const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const money = (value: number) => `A$${value.toFixed(2)}`;

function extraLabel(target: string) {
  if (norm(target) === "bags") return "Find a bag";
  if (norm(target) === "shoes") return "Find shoes";
  if (norm(target) === "accessories") return "Find accessories";
  return `Find ${target.toLowerCase()}`;
}

function ProductCard({ product, preferences, featured, onOpen, onAction }: {
  product: DisplayProduct;
  preferences: ShoppingPreferences | null;
  featured: boolean;
  onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
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
      setChoosing(false);
      setFeedback("Added to cart. Other items in your cart are unchanged.");
    } catch {
      setFeedback("I couldn't update the cart. Please try again.");
    }
  }

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""}`}>
      <div className={styles.cardLayout}>
        <Link className={styles.imageLink} href={`/products/${encodeURIComponent(product.product_id)}`}
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
        </div>
      </div>
      {onAction && product.extra_target ? (
        <div className={styles.completeLook}>
          <h4>Want to complete the look?</h4>
          <p>Explore {product.extra_target.toLowerCase()} to go with this item.</p>
          <button type="button" className={styles.chip} onClick={() => onAction("cross_sell", product)}>
            {extraLabel(product.extra_target)}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ShoppingProductResults({ products, preferences, label, onOpen, onAction }: {
  products: DisplayProduct[];
  preferences: ShoppingPreferences | null;
  label: string;
  onOpen: () => void;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const id = useId();
  const featured = products.length === 1;
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
          <span>{products.length} products · swipe or use the arrows</span>
          <div className={styles.rowArrows}>
            <button type="button" aria-label="Previous products" aria-controls={id} onClick={() => scroll(-1)}>←</button>
            <button type="button" aria-label="Next products" aria-controls={id} onClick={() => scroll(1)}>→</button>
          </div>
        </div>
      ) : null}
      <div id={id} ref={row} tabIndex={featured ? undefined : 0} role="list"
        aria-label={label} className={featured ? styles.singleResult : styles.productRow}>
        {products.map(product => (
          <div role="listitem" key={product.product_id} className={featured ? styles.featureItem : styles.rowItem}>
            <ProductCard product={product} preferences={preferences} featured={featured} onOpen={onOpen} onAction={onAction} />
          </div>
        ))}
      </div>
    </section>
  );
}