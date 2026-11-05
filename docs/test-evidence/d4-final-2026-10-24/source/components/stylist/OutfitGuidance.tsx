"use client";

import { dressCodes, dressCodeMessage, type DressCode } from "@/lib/stylist/dressCode";
import { formatAud } from "@/lib/format-price";
import { suggestedOutfit } from "@/lib/stylist/outfitPresentation";
import type { ChatProduct } from "@/lib/stylist/conversationProtocol";
import type { OutfitChoices } from "@/lib/stylist/outfitBudgetSchema";
import styles from "./ShoppingConversation.module.css";

export function DressCodeChoices({ value, disabled, onChoose }: {
  value: DressCode | null; disabled: boolean; onChoose: (message: string) => void;
}) {
  const current = dressCodes.find(code => code.value === (value ?? "any_formal"))!;
  return <section className={styles.dressCode} aria-label="Event dress code">
    <h3>{value && value !== "any_formal" ? `${current.label} guidance` : "What kind of formal event?"}</h3>
    <p>{value && value !== "any_formal" ? "You can change the dress code below." : "Optional · Choose a dress code to narrow your picks."}</p>
    <div className={styles.dressCodeChoices} role="group" aria-label="Choose a dress code">
      {dressCodes.map(code => <button key={code.value} type="button" className={styles.chip}
        aria-pressed={current.value === code.value} disabled={disabled}
        onClick={() => onChoose(dressCodeMessage(code.value))}>{code.label}</button>)}
    </div>
    <p className={styles.dressCodeHint}>{current.guidance}</p>
  </section>;
}

export function OutfitGuidance({ products, choices, limit }: {
  products: ChatProduct[]; choices: OutfitChoices; limit: number;
}) {
  const suggestion = suggestedOutfit(products, choices, limit);
  if (!suggestion) return <p className={styles.message}>I’ve found options to mix and match. Choose one item from each group below.</p>;
  const pairing = new Intl.ListFormat("en-AU", { style: "long", type: "conjunction" })
    .format(suggestion.products.map(product => product.product_name));
  return <>
    <p className={styles.message}>
      I’d start with the <strong>{pairing}</strong>. Together, they come to <strong>{formatAud(suggestion.total)} total</strong>,
      {" "}leaving {formatAud(suggestion.remaining)} of your {formatAud(limit)} budget.
      {" "}You can also mix and match one item from each group below.
    </p>
    <details className={`${styles.messageDetails} ${styles.pairingDetails}`}>
      <summary>Why this pairing?</summary>
      <p>{suggestion.reasons.join(" ")}</p>
      <p className={styles.pairingNote}>Styling suggestion based on the listed types and colours. Check the invitation, shades and fit before buying.</p>
    </details>
  </>;
}
