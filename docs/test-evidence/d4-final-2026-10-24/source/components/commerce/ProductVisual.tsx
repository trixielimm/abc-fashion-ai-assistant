import { cn } from "@/lib/cn";

export function ProductVisual({
  name,
  category,
  compact = false,
  className,
}: {
  name: string;
  category: string | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex aspect-[3/4] flex-col justify-between overflow-hidden bg-[#eeeae4] text-[#514d47]",
        compact ? "p-2" : "p-5",
        className
      )}
    >
      <div className={cn("absolute border border-[#cfc7bc]", compact ? "inset-2" : "inset-3")} />
      <span className={cn("relative font-medium tracking-[0.22em] uppercase", compact ? "text-[7px]" : "text-[10px]")}>
        {compact ? "ABC" : "ABC / Fashion"}
      </span>
      <span className={cn("relative self-center font-serif font-light leading-none text-[#d1c8bc]", compact ? "text-[3.75rem]" : "text-[clamp(5rem,14vw,10rem)]")}>
        {name.charAt(0)}
      </span>
      {compact ? (
        <span className="relative text-[7px] tracking-[0.18em] uppercase">Fashion</span>
      ) : (
        <div className="relative border-t border-[#cfc7bc] pt-3">
          <p className="text-[9px] tracking-[0.18em] uppercase">
            {category ?? "The Collection"}
          </p>
          <p className="mt-1 line-clamp-2 font-serif text-lg leading-tight">
            {name}
          </p>
        </div>
      )}
    </div>
  );
}
