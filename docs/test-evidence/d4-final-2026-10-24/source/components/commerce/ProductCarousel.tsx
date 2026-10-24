"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Container } from "@/components/layout/Container";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ChevronIcon } from "@/components/ui/icons";
import type { StorefrontProduct } from "@/lib/catalogue/storefront";

export function ProductCarousel({
  title,
  products,
}: {
  title: string;
  products: StorefrontProduct[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const node = scrollerRef.current;
    if (!node) return;
    const card = node.querySelector("article");
    const delta = (card instanceof HTMLElement ? card.offsetWidth : 260) + 16;
    node.scrollBy({ left: direction * delta, behavior: "smooth" });
  }

  return (
    <section id="this-season" className="scroll-mt-8 py-6 lg:py-10">
      <Container>
        <SectionHeader
          label={title}
          action={
            <div className="flex gap-2">
              <IconButton
                label="Previous products"
                onClick={() => scrollByCard(-1)}
              >
                <ChevronIcon direction="left" />
              </IconButton>
              <IconButton
                label="Next products"
                onClick={() => scrollByCard(1)}
              >
                <ChevronIcon direction="right" />
              </IconButton>
            </div>
          }
        />
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[23.5%]"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
