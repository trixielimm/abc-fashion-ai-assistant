"use client";

import { useEffect, useId, useRef } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CloseIcon } from "@/components/ui/icons";
import { getProductImageEndpoint } from "@/lib/product-image";
import type { StylingState } from "@/lib/stylist/commerceSchema";
import styles from "./ShoppingConversation.module.css";

export function OutfitSummary({ styling, disabled, open, onRemove, onRemoveExternal }: {
  styling: StylingState;
  disabled: boolean;
  open: boolean;
  onRemove: (productId: string, productName: string) => void;
  onRemoveExternal: (description: string) => void;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const count = styling.outfit.length + styling.external_items.length;
  const hasOutfit = count > 0 || styling.owned_categories.length > 0;

  useEffect(() => {
    if (!open || !hasOutfit) sheet.current?.close();
  }, [open, hasOutfit]);

  if (!hasOutfit) return null;

  const label = <>
    <strong>Your outfit</strong>
    <span key={`${count}:${styling.owned_categories.join(",")}`} className={styles.outfitCount}>
      {count ? `${count} ${count === 1 ? "item" : "items"}` : "Owned items"}
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
            {piece.ownership === "owned" ? <small>Already owned</small> : null}
          </div>
          <button type="button" className={styles.outfitRemove} disabled={disabled}
            aria-label={`Remove ${piece.product_name} from outfit`}
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
            aria-label={`Remove ${piece.description} from outfit`}
            onClick={() => { if (inSheet) sheet.current?.close(); onRemoveExternal(piece.description); }}>Remove</button>
        </li>)}
      </ul> : null}
    </>;
  }

  return (
    <aside className={styles.outfitSummary} aria-label="Selected outfit">
      <details className={styles.outfitDesktop}>
        <summary className={styles.outfitToggle}>
          <span className={styles.outfitLabel}>{label}</span>
          <span className={styles.outfitExpand}>Expand <span aria-hidden="true">⌄</span></span>
          <span className={styles.outfitCollapse}>Collapse <span aria-hidden="true">⌃</span></span>
        </summary>
        <div className={styles.outfitPanel}>{items()}</div>
      </details>
      <button type="button" className={`${styles.outfitToggle} ${styles.outfitMobileToggle}`}
        aria-haspopup="dialog" aria-controls={titleId}
        onClick={() => sheet.current?.showModal()}>
        <span className={styles.outfitLabel}>{label}</span>
        <span>View <span aria-hidden="true">⌄</span></span>
      </button>
      <dialog ref={sheet} id={titleId} className={styles.outfitSheet} aria-labelledby={`${titleId}-heading`}
        onClose={event => event.stopPropagation()}
        onCancel={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); if (event.target === sheet.current) sheet.current?.close(); }}>
        <header className={styles.outfitSheetHeader}>
          <h3 id={`${titleId}-heading`}>Your outfit <span>{count ? `${count} ${count === 1 ? "item" : "items"}` : "Owned items"}</span></h3>
          <button type="button" className={styles.iconButton} aria-label="Close your outfit" onClick={() => sheet.current?.close()}><CloseIcon /></button>
        </header>
        <div className={styles.outfitSheetBody}>{items(true)}</div>
      </dialog>
    </aside>
  );
}
