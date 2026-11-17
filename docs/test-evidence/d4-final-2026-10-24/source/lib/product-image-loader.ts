"use client";

import type { ImageLoaderProps } from "next/image";

// Keep the saved/cart URL stable; only browser image requests need a width.
export default function productImageLoader({ src, width }: ImageLoaderProps): string {
  return `${src}?w=${width}`;
}
