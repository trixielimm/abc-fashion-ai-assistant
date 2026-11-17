import type { Session } from "@/lib/stylist/conversationProtocol";
import { shoppingRequestSummary } from "@/lib/stylist/requestPresentation";
import styles from "./ShoppingConversation.module.css";

export function ShoppingRequestSummary({ session }: { session: Session }) {
  const summary = shoppingRequestSummary(session);
  if (!summary.item.length && !summary.shared.length && !summary.unverified.length) return null;
  return <details className={styles.savedRequest}>
    <summary><span className={styles.savedRequestLabel}>Your saved search</span>
      <span>{summary.item.join(" · ") || "Shared preferences saved"}</span>
      {summary.shared.length ? <span className={styles.sharedRuleCount}>Shared rules</span> : null}
    </summary>
    <div className={styles.savedRequestDetails}>
      {summary.item.length ? <p><strong>This search</strong><br />{summary.item.join(" · ")}</p> : null}
      {summary.shared.length ? <p><strong>Rules for all searches</strong><br />{summary.shared.join(" · ")}</p> : null}
      {summary.unverified.length ? <p><strong>Still to verify</strong><br />{summary.unverified.join(" · ")}</p> : null}
      <p>Tell me which detail to change. Your other preferences stay saved.</p>
    </div>
  </details>;
}
