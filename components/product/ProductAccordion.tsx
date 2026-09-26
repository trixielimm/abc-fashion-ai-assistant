import type { ProductDetailMock } from "@/lib/product-detail-mock";

const DELIVERY_COPY =
  "Standard delivery is available across Australia. Returns are accepted within 30 days of delivery.";

export function ProductAccordion({ product }: { product: ProductDetailMock }) {
  const details = [
    product.fit ? `Fit: ${product.fit}` : null,
    product.style ? `Style: ${product.style}` : null,
    product.occasion ? `Occasion: ${product.occasion}` : null,
    product.season ? `Season: ${product.season}` : null,
  ].filter((detail): detail is string => detail !== null);

  const sections = [
    { title: "Details", content: details.join(" · ") },
    {
      title: "Material and Care",
      content: product.material ? `Material: ${product.material}` : "",
    },
    { title: "Delivery and Returns", content: DELIVERY_COPY },
  ];

  return (
    <div className="mt-4 border-t border-border">
      {sections.map((section) => (
        <div key={section.title} className="border-b border-border">
          <div className="flex min-h-12 items-center justify-between gap-4 text-[13px] text-foreground">
            <span>{section.title}</span>
            <span aria-hidden="true" className="text-muted">
              +
            </span>
          </div>
          {section.content ? <div hidden>{section.content}</div> : null}
        </div>
      ))}
    </div>
  );
}
