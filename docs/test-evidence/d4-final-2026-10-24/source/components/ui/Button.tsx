import Link from "next/link";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "inline-flex items-center justify-center gap-2.5 bg-foreground px-6 py-3 text-[10px] font-medium tracking-[0.16em] text-background uppercase transition-opacity hover:opacity-80",
  ghost:
    "inline-flex items-center text-[11px] tracking-[0.2em] text-foreground uppercase underline underline-offset-[6px] decoration-foreground/80 transition-opacity hover:opacity-60",
  onDark:
    "inline-flex items-center text-[11px] tracking-[0.2em] text-white uppercase underline underline-offset-[6px] decoration-white/80 transition-opacity hover:opacity-70",
} as const;

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  className,
}: ButtonProps) {
  return (
    <Link href={href} className={cn(variants[variant], className)}>
      {children}
    </Link>
  );
}
