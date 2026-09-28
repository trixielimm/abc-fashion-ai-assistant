import Image from "next/image";
import { ProductVisual } from "@/components/commerce/ProductVisual";
import { cn } from "@/lib/cn";
import type { ProductDetailMock } from "@/lib/product-detail-mock";

export function ProductGallery({
  product,
  fallbackImage,
  productName,
}: {
  product: ProductDetailMock;
  fallbackImage?: string;
  productName: string;
}) {
  const images = product.image_gallery?.length
    ? product.image_gallery
    : [fallbackImage ?? product.image_key].filter((image): image is string =>
        typeof image === "string" && image.startsWith("/"),
      );

  if (images.length === 0) {
    return <ProductVisual name={productName} category={product.subcategory ?? product.category} />;
  }

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-3.5",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="relative aspect-[3/4] overflow-hidden bg-surface"
        >
          <Image
            src={image}
            alt={`${productName}, view ${index + 1}`}
            fill
            priority={index === 0}
            sizes={
              images.length === 1
                ? "(max-width: 768px) 90vw, 55vw"
                : "(max-width: 768px) 50vw, 30vw"
            }
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
