"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CloseIcon } from "@/components/ui/icons";
import { getProductImageEndpoint } from "@/lib/product-image";
import type { StylingState } from "@/lib/stylist/commerceSchema";
import { outfitMoney, outfitTotals } from "@/lib/stylist/outfitPresentation";
import styles from "./ShoppingConversation.module.css";

export function OutfitSummary({ styling, disabled, open, feedback = "", onRemove, onRemoveExternal }: {
  styling: StylingState;
  disabled: boolean;
  open: boolean;
  feedback?: string;
  onRemove: (productId: string, productName: string) => void;
  onRemoveExternal: (description: string) => void;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const count = styling.outfit.length + styling.external_items.length;
  const totals = outfitTotals(styling);
  const budgetLabel = <span className={styles.outfitBudget}>
    <strong>{outfitMoney(totals.total)} {totals.completePrices
      ? styling.outfit_request?.anchor_product_ids?.length ? "new pieces" : "total" : "known subtotal"}</strong>
    {totals.remaining !== null ? <span className={totals.remaining < 0 ? styles.overBudget : undefined}>
      {outfitMoney(Math.abs(totals.remaining))} {totals.remaining < 0 ? "over budget" : "remaining"}
    </span> : !totals.completePrices ? <span>Some prices unavailable</span> : null}
  </span>;

  useEffect(() => {
    if (!open) sheet.current?.close();
  }, [open]);

  const label = <>
    <strong>Your look</strong>
    <span key={`${count}:${styling.owned_categories.join(",")}`} className={styles.outfitCount}>
      {count ? `${count} ${count === 1 ? "item" : "items"}` : styling.owned_categories.length ? "Owned items" : "0 items"}
    </span>
  </>;

  function items(inSheet = false) {
    return <>
      {styling.owned_categories.length ? <p className={styles.ownedCategories}>
        Already owned: {styling.owned_categories.join(", ")}
      </p> : null}
      {count ? <ul className={styles.outfitList}>
        {styling.outfit.map(piece => <li key={piece.product_id}>
          <ProductImage src={getProductImageEndpoint(piece.product_id)} name={piece.product_name}
            category={piece.category} compact sizes="40px" className={styles.outfitThumbnail} />
          <div className={styles.outfitPiece}>
            <span>{piece.product_name}</span>
            <small>{piece.ownership === "owned" ? "Already owned · No new cost"
              : piece.price_aud !== undefined ? outfitMoney(piece.price_aud) : "Price unavailable"}</small>
          </div>
          <button type="button" className={styles.outfitRemove} disabled={disabled}
            aria-label={`Remove ${piece.product_name} from your look`}
            onClick={() => {
              if (inSheet) sheet.current?.close();
              onRemove(piece.product_id, piece.product_name);
            }}>Remove</button>
        </li>)}
        {styling.external_items.map(piece => <li key={piece.external_id}>
          <div className={styles.outfitPiece}>
            <span>{piece.description}</span><small>Already owned · From your description</small>
          </div>
          <button type="button" className={styles.outfitRemove} disabled={disabled}
            aria-label={`Remove ${piece.description} from your look`}
            onClick={() => { if (inSheet) sheet.current?.close(); onRemoveExternal(piece.description); }}>Remove</button>
        </li>)}
      </ul> : null}
    </>;
  }

  return (
    <aside className={styles.outfitSummary} aria-label="Your look">
      <div className={styles.outfitBar}>
        <span className={styles.outfitLabel}>{label}</span>
        <p className={styles.selectionStatus} role="status" aria-live="polite" aria-atomic="true">
          {feedback || (styling.outfit_request ? "Choose one item from each group." : count ? "Saved for styling · Separate from your cart." : "Save pieces here to build a look.")}
        </p>
        {budgetLabel}
        <button type="button" className={`${styles.outfitToggle} ${styles.outfitDesktopToggle}`}
          aria-expanded={expanded} aria-controls={`${titleId}-panel`}
          onClick={() => setExpanded(previous => !previous)}>
          {expanded ? "Hide look" : "View look"} <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
        </button>
        <button type="button" className={`${styles.outfitToggle} ${styles.outfitMobileToggle}`}
          aria-haspopup="dialog" aria-controls={titleId}
          onClick={() => sheet.current?.showModal()}>
          View look <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <div id={`${titleId}-panel`} className={styles.outfitPanel} hidden={!expanded}>
        {count || styling.owned_categories.length ? items() : <p className={styles.ownedCategories}>Use “Save to look” on a product to save it here. This does not add it to your cart.</p>}
      </div>
      <dialog ref={sheet} id={titleId} className={styles.outfitSheet} aria-labelledby={`${titleId}-heading`}
        onClose={event => event.stopPropagation()}
        onCancel={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); if (event.target === sheet.current) sheet.current?.close(); }}>
        <header className={styles.outfitSheetHeader}>
          <h3 id={`${titleId}-heading`}>Your look <span>{count ? `${count} ${count === 1 ? "item" : "items"}` : styling.owned_categories.length ? "Owned items" : "0 items"}</span></h3>
          <button type="button" className={styles.iconButton} aria-label="Close your look" onClick={() => sheet.current?.close()}><CloseIcon /></button>
        </header>
        <div className={styles.outfitSheetBody}>{budgetLabel}
          {count || styling.owned_categories.length ? items(true) : <p className={styles.ownedCategories}>Use “Save to look” on a product to save it here. This does not add it to your cart.</p>}
        </div>
      </dialog>
    </aside>
  );
}
