import Image from "next/image";
import { cn } from "@/lib/cn";

export function LoadingScreen({
  overlay = false,
  contained = false,
}: {
  overlay?: boolean;
  contained?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={contained ? "Loading products" : "Loading page"}
      className={cn(
        "flex items-center justify-center px-6 text-center",
        contained
          ? "sticky top-24 h-[min(60svh,420px)]"
          : overlay
          ? "site-page-loader fixed inset-0 z-[100] bg-background"
          : "min-h-[calc(100svh-72px)] bg-background",
      )}
    >
      <div className="w-full max-w-[280px]">
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            aria-hidden="true"
            className="site-loading-mark h-12 w-12"
          />
          <span className="font-serif text-[28px] italic leading-none tracking-tight">
            ABC Fashion
          </span>
        </div>
        <div className="mx-auto mt-8 h-px w-40 overflow-hidden bg-border">
          <span className="site-loading-progress block h-full w-1/3 bg-foreground" />
        </div>
        <p className="mt-4 text-[10px] tracking-[0.2em] text-muted uppercase">
          {contained ? "Loading your products" : "Preparing your experience"}
        </p>
      </div>
    </div>
  );
}
