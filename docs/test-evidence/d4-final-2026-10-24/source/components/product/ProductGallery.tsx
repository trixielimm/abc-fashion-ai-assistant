import { ProductImage } from "@/components/commerce/ProductImage";
import { getProductImageSrc } from "@/lib/product-image";
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
    : [fallbackImage ?? getProductImageSrc(product.product_id, product.image_key)];

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-3.5",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {images.map((image, index) => (
        <ProductImage
          key={`${image}-${index}`}
          src={image}
          name={`${productName}, view ${index + 1}`}
          category={product.subcategory ?? product.category}
          preload={index === 0}
          sizes={images.length === 1 ? "(max-width: 768px) 90vw, 55vw" : "(max-width: 768px) 50vw, 30vw"}
        />
      ))}
    </div>
  );
}
