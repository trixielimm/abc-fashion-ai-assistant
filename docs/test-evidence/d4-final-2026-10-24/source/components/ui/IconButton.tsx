import Link from "next/link";
import { cn } from "@/lib/cn";

const baseClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

type IconButtonProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  expanded?: boolean;
  controls?: string;
  id?: string;
  compact?: boolean;
};

export function IconButton({
  label,
  children,
  className,
  href,
  onClick,
  type = "button",
  expanded,
  controls,
  id,
  compact = false,
}: IconButtonProps) {
  const classes = cn(baseClass, compact
    ? "relative before:pointer-events-none before:absolute before:inset-1 before:rounded-full before:border before:border-foreground before:content-['']"
    : "border border-foreground", className);

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      id={id}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
