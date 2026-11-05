"use client";

import { useEffect } from "react";
import { canUseAudienceChoice, demoChoices, demoRound, demoRouteNumber, type DemoProgress } from "@/lib/demo/journey";
import type { Session } from "@/lib/stylist/conversationProtocol";
import styles from "./ShoppingConversation.module.css";

export function DemoAudienceChoices({ progress, session, disabled, open, onChoose, onReset }: {
  progress: DemoProgress; session: Session; disabled: boolean; open: boolean;
  onChoose: (message: string) => void; onReset: () => void;
}) {
  const choices = demoChoices(progress);
  const ready = canUseAudienceChoice(progress, session);
  const round = demoRound(progress);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!open || event.repeat || !event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === "KeyR") { event.preventDefault(); onReset(); return; }
      const choice = choices[Number(event.code.replace("Digit", "")) - 1];
      if (choice && !disabled && ready) { event.preventDefault(); onChoose(choice.message); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [choices, disabled, onChoose, onReset, open, ready]);

  return <div className={styles.demoAudience} aria-label="Audience choices" data-round={round} data-route={demoRouteNumber(progress) ?? ""}>
    <p className={styles.eyebrow}>{round < 4 ? `Audience vote ${round} of 3` : "Your look, your choice"}</p>
    <p className={styles.demoQuestion}>{["Where are we going?", "What should we change?", "What should we ask next?", "Save a favourite or add it to your bag."][round - 1]}</p>
    {choices.length ? <div className={styles.starters}>
      {choices.map((choice, index) => <button key={choice.id} type="button" className={styles.chip}
        disabled={disabled || !ready} onClick={() => onChoose(choice.message)} title={`Option/Alt + ${index + 1}`}>
        <span className={styles.demoOptionNumber}>{index + 1}</span>{choice.label}
      </button>)}
    </div> : null}
    {!ready && round === 3 ? <p className={styles.notice}>Reset the demo to restore the two dresses for this vote.</p> : null}
  </div>;
}
