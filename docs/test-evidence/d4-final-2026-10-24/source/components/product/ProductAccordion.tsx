"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ProductDetailMock } from "@/lib/product-detail-mock";
import { DELIVERY_AND_RETURNS_COPY } from "@/lib/storePolicies";
import { getProductSpecification, specificationDetails } from "@/lib/stylist/productSpecifications";

export function ProductAccordion({ product }: { product: ProductDetailMock }) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(),
  );
  const specification = getProductSpecification(product);
  const details = [
    ...(specification ? specificationDetails(specification) : []),
    product.fit ? `Fit: ${product.fit}` : null,
    product.style ? `Style: ${product.style}` : null,
    product.occasion ? `Occasion: ${product.occasion}` : null,
    product.season ? `Season: ${product.season}` : null,
  ].filter((detail): detail is string => detail !== null);

  const sections = [
    { title: "Details", content: details.join(" · ") },
    {
      title: "Material and Care",
      content: [product.material ? `Material: ${product.material}` : null, specification?.care_instructions].filter(Boolean).join(" · "),
    },
    { title: "Delivery and Returns", content: DELIVERY_AND_RETURNS_COPY },
  ];

  return (
    <div className="mt-4 border-t border-border">
      {sections.map((section) => (
        <div key={section.title} id={section.title === "Delivery and Returns" ? "delivery-returns" : undefined} className="border-b border-border">
          <button
            type="button"
            aria-expanded={openSections.has(section.title)}
            aria-controls={`product-accordion-${section.title.replaceAll(" ", "-")}`}
            onClick={() =>
              setOpenSections((current) => {
                const next = new Set(current);
                if (next.has(section.title)) next.delete(section.title);
                else next.add(section.title);
                return next;
              })
            }
            className="flex min-h-12 w-full items-center justify-between gap-4 text-left text-[13px] text-foreground"
          >
            <span>{section.title}</span>
            <span aria-hidden="true" className="text-muted">
              {openSections.has(section.title) ? "−" : "+"}
            </span>
          </button>
          <div
            id={`product-accordion-${section.title.replaceAll(" ", "-")}`}
            hidden={!openSections.has(section.title)}
          >
            {section.content ? (
              section.title === "Details" ? <ul className="space-y-2 pb-4 text-[12px] leading-5 text-muted">
                {details.map(detail => <li key={detail}>{detail}</li>)}
              </ul> : <p className={cn("pb-4 text-[12px] leading-5 text-muted")}>{section.content}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
