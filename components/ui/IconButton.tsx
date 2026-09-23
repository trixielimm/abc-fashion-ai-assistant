import Link from "next/link";
import { cn } from "@/lib/cn";

const baseClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground text-foreground transition-opacity hover:opacity-60";

type IconButtonProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

export function IconButton({
  label,
  children,
  className,
  href,
  onClick,
  type = "button",
}: IconButtonProps) {
  const classes = cn(baseClass, className);

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
