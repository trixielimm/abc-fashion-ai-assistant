"use client";

import { useEffect } from "react";
import { useStylist } from "./StylistProvider";

import type { ViewedProduct } from "@/lib/stylist/viewedProduct";

export function ProductPageContext({
  product,
}: {
  product: ViewedProduct;
}) {
  const { registerViewedProduct } = useStylist();

  useEffect(
    () => registerViewedProduct(product),
    [product, registerViewedProduct]
  );

  return null;
}