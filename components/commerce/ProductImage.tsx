"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductVisual } from "@/components/commerce/ProductVisual";
import { cn } from "@/lib/cn";

export function ProductImage({
  src,
  name,
  category,
  compact = false,
  sizes,
  preload = false,
  className,
}: {
  src?: string | null;
  name: string;
  category: string | null;
  compact?: boolean;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <ProductVisual name={name} category={category} compact={compact} className={className} />;
  }

  return (
    <div className={cn("relative aspect-[3/4] overflow-hidden bg-surface", className)}>
      <Image
        src={src}
        alt={name}
        fill
        sizes={sizes}
        preload={preload}
        unoptimized={src.startsWith("/api/products/")}
        className="object-cover"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
