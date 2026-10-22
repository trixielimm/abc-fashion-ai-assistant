"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductVisual } from "@/components/commerce/ProductVisual";
import { cn } from "@/lib/cn";
import productImageLoader from "@/lib/product-image-loader";

export function ProductImage({
  src,
  name,
  category,
  compact = false,
  sizes,
  preload = false,
  fill = false,
  className,
}: {
  src?: string | null;
  name: string;
  category: string | null;
  compact?: boolean;
  sizes: string;
  preload?: boolean;
  fill?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <ProductVisual name={name} category={category} compact={compact} className={cn(fill && "h-full w-full", className)} />;
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface", fill ? "h-full w-full" : "aspect-[3/4]", className)}>
      <Image
        src={src}
        alt={name}
        fill
        sizes={sizes}
        preload={preload}
        loader={src.startsWith("/api/products/") ? productImageLoader : undefined}
        className="object-cover"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
