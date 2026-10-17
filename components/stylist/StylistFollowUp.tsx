"use client";

import { useId, useState } from "react";
import { outfitDiscoveryQuestions } from "@/lib/stylist/discoveryQuestions";
import type { OutfitChoices } from "@/lib/stylist/outfitBudgetSchema";
import styles from "./ShoppingConversation.module.css";

export function StylistFollowUp({ question, groups, onKeepBrowsing }: {
  question: string;
  groups?: OutfitChoices["groups"];
  onKeepBrowsing: (trigger: HTMLButtonElement) => void;
}) {
  const titleId = useId();
  const [dismissed, setDismissed] = useState(false);
  const prompts = outfitDiscoveryQuestions(groups ?? []).filter(item => question.includes(item.question));

  if (dismissed) return <p role="status" className={styles.followUpDismissed}>
    Keep exploring your picks. You can refine them anytime.
  </p>;

  return (
    <section className={`${styles.replyBubble} ${styles.followUp}`} aria-labelledby={titleId}>
      <div className={styles.followUpHeader}>
        <span className={styles.speaker}>AI Stylist</span>
        <span className={styles.followUpOptional}>Optional</span>
      </div>
      <h3 id={titleId} className={styles.followUpTitle}>Want to narrow it down?</h3>
      {prompts.length ? <dl className={styles.followUpQuestions}>
        {prompts.map(item => <div key={item.question}>
          <dt>{item.label}</dt><dd>{item.prompt}</dd>
        </div>)}
      </dl> : <p className={styles.message}>
        {question.replace(/\s*You can also keep browsing these options\.\s*$/, "").trim()}
      </p>}
      <div className={styles.followUpFooter}>
        <button type="button" className={styles.followUpBrowse} onClick={event => {
          setDismissed(true);
          onKeepBrowsing(event.currentTarget);
        }}>Keep browsing</button>
        <span>{prompts.length > 1 ? "Answer either question, or neither." : "You can refine your picks anytime."}</span>
      </div>
    </section>
  );
}
