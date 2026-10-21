"use client";

import { useId } from "react";
import type { ChatProduct, ComplementaryOffer } from "@/lib/stylist/conversationProtocol";
import { formatAud } from "@/lib/format-price";
import { ShoppingProductResults, type ShoppingAction } from "./ShoppingProductResults";
import styles from "./ShoppingConversation.module.css";

export function FinishingTouches({ offer, anchors, disabled, selectedIds, onAction, onOpen, onMatch, onDismiss, onEvent, open }: {
  offer: ComplementaryOffer; anchors: ChatProduct[]; disabled: boolean; selectedIds: string[]; open: boolean;
  onAction?: (kind: ShoppingAction, product: ChatProduct) => void; onOpen: () => void;
  onMatch: (id: string) => void; onDismiss: (pause: boolean) => void;
  onEvent: (kind: "select" | "own" | "reject" | "add_to_cart", id: string, position: number) => void;
}) {
  const id = useId();
  return <section className={styles.finishingTouches} aria-labelledby={id}>
    <div className={styles.finishingHeading}>
      <p className={styles.eyebrow}>Complete the look</p>
      <h3 id={id}>Optional finishing touches</h3>
      <p className={styles.notice}>To help complete your look, here {offer.items.length === 1 ? "is an optional addition" : "are a couple of optional additions"} for <strong>{offer.anchor.product_name}</strong>.</p>
      <p className={styles.notice}>{offer.anchor_ownership === "example" && !selectedIds.includes(offer.anchor.product_id)
        ? "This is a styling example; you haven't selected this item."
        : offer.anchor_ownership === "owned" ? "Your owned item is the styling reference." : "Your selected item is the styling reference."}</p>
      <p className={styles.finishingPrice}>{offer.combined_limit_aud === null ? "Priced separately · Your item budget stays unchanged."
        : `${formatAud(offer.total_aud)} for this combination · Within your ${formatAud(offer.combined_limit_aud)} total`}</p>
    </div>
    <ShoppingProductResults products={offer.items.map(item => item.product)} preferences={null}
      preferencesByProduct={Object.fromEntries(offer.items.map(item => [item.product.product_id, item.preferences]))}
      label="Optional complementary products" onOpen={onOpen} onAction={onAction} selectedIds={selectedIds}
      allowOffers={false} actionDisabled={disabled} onEvent={onEvent} open={open} />
    <div className={styles.finishingControls}>
      {anchors.length > 1 ? <label className={styles.matchAnchor}>Match a different {offer.anchor.subcategory === "Dresses" ? "dress" : "item"}
        <select value={offer.anchor.product_id} disabled={disabled} onChange={event => onMatch(event.target.value)}>
          {anchors.map(product => <option key={product.product_id} value={product.product_id}>{product.product_name}</option>)}
        </select>
      </label> : null}
      <div className={styles.starters}>
        <button className={styles.chip} type="button" disabled={disabled} onClick={() => onDismiss(false)}>Hide these suggestions</button>
        <button className={styles.chip} type="button" disabled={disabled} onClick={() => onDismiss(true)}>No more extras</button>
      </div>
    </div>
  </section>;
}
