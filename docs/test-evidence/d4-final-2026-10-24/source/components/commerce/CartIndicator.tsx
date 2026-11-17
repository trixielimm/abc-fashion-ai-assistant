import type { ReactNode } from "react";
import styles from "./CartIndicator.module.css";

export function CartIndicator({ count, children, compact = false }: { count: number; children: ReactNode; compact?: boolean }) {
  return (
    <span className={`${styles.indicator} ${compact ? styles.compact : ""}`} aria-hidden="true">
      <span key={count} className={styles.value}>
        {count > 0 ? <span className={count > 99 ? styles.compactCount : styles.count}>{count}</span> : children}
      </span>
    </span>
  );
}
