import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/cn";
import { featuredProducts } from "@/lib/mock-data";
import { productDetailMocks } from "@/lib/product-detail-mock";
import { getCatalogueProductById } from "@/lib/recommendations/catalogue";
import { ProductPageContext } from "@/components/stylist/ProductPageContext";
import { readViewedProduct } from "@/lib/stylist/viewedProduct";
import { ProductAccordion } from "@/components/product/ProductAccordion";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { enrichCommercialCatalogue } from "@/lib/stylist/commerceCatalogue";
import { getProductSpecification } from "@/lib/stylist/productSpecifications";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const mockProduct = productDetailMocks.find(
    (item) => item.product_id === productId,
  );
  const catalogueProduct = mockProduct ? null : await getCatalogueProductById(productId);
  const product = mockProduct ?? (catalogueProduct ? (await enrichCommercialCatalogue([catalogueProduct]))[0] : null);
  const listingProduct = featuredProducts.find((item) => item.id === productId);
  const productName = listingProduct?.name ?? product?.product_name;

  if (!product || !productName) notFound();
  const pageProduct = mockProduct
  ? null
  : readViewedProduct(product);

  const breadcrumbs = product.category
    ? [
        product.gender,
        product.category,
        product.subcategory,
        productName,
      ].filter((part): part is string => Boolean(part))
    : [productName];

  return (
    <div className="min-h-full bg-panel">
      {pageProduct ? (
  <ProductPageContext product={pageProduct} />
) : null}
      <Container
        className={cn(
          "max-w-[1240px] px-5 pb-16 pt-5 sm:px-8 lg:px-10 lg:pb-20",
        )}
      >
        <nav aria-label="Breadcrumb" className="text-[12px] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbs.map((part, index) => (
              <li key={`${part}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                <span
                  className={
                    index === breadcrumbs.length - 1
                      ? "text-foreground"
                      : undefined
                  }
                >
                  {part}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 grid gap-8 md:grid-cols-[1.15fr_1fr] md:gap-10 lg:gap-14">
          <ProductGallery
            product={product}
            fallbackImage={listingProduct?.image}
            productName={productName}
          />
          <div>
            <ProductInfo
              product={{ ...product, description: getProductSpecification(product)?.description ?? product.description }}
              listingProduct={listingProduct}
              productName={productName}
              productId={productId}
            />
            <ProductAccordion product={product} />
          </div>
        </div>

        <RelatedProducts currentProductId={productId} />
      </Container>
    </div>
  );
}
