import Link from "next/link";
import type { Metadata } from "next";
import { ProductImage } from "@/components/commerce/ProductImage";
import { getProductImageSrc } from "@/lib/product-image";
import { Container } from "@/components/layout/Container";
import { SearchIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/mock-data";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { searchCatalogue, type SearchProduct } from "@/lib/search/catalogueSearch";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Search | ABC Fashion",
  description: "Search the ABC Fashion collection for clothing, shoes, bags and accessories.",
};

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function searchHref(query: string, category?: string, page?: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (page && page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/search?${suffix}` : "/search";
}

function ResultCard({ product }: { product: SearchProduct }) {
  const category = product.subcategory ?? product.category;

  return (
    <Link
      href={`/products/${encodeURIComponent(product.product_id)}`}
      className="group block min-w-0"
    >
      <ProductImage
        src={getProductImageSrc(product.product_id, product.image_key)}
        name={product.product_name}
        category={category}
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 23vw"
        className="transition-colors duration-300 group-hover:bg-[#e6e0d7]"
      />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.13em] text-muted uppercase">
            {product.brand_line ?? category ?? "ABC Fashion"}
          </p>
          <h2 className="mt-1 font-serif text-lg leading-tight text-foreground group-hover:underline group-hover:underline-offset-4">
            {product.product_name}
          </h2>
          {product.colour ? (
            <p className="mt-1 text-xs text-muted">{product.colour}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-sm text-foreground">
          {formatPrice(product.price_aud)}
        </p>
      </div>
    </Link>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 120);
  const requestedCategory = first(params.category).trim();
  const pageValue = first(params.page);
  const requestedPage = /^[1-9]\d{0,3}$/.test(pageValue)
    ? Number(pageValue)
    : 1;

  let products: SearchProduct[] = [];
  let failed = false;

  try {
    products = searchCatalogue(await getCatalogueProducts(), query);
  } catch (error) {
    console.error("Search catalogue unavailable:", error instanceof Error ? error.name : "UnknownError");
    failed = true;
  }

  const categories = Array.from(
    new Set(products.map((product) => product.category).filter((value): value is string => Boolean(value)))
  ).sort();
  const category = categories.find(
    (value) => value.toLowerCase() === requestedCategory.toLowerCase()
  );
  const filtered = category
    ? products.filter((product) => product.category === category)
    : products;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-[70vh] bg-background pb-20 sm:pb-24">
      <Container className="pt-10 sm:pt-14 lg:pt-16">
        <div className="border-b border-border pb-9 sm:pb-12">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
            ABC Fashion / Discover
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.75rem,7vw,5rem)] leading-[0.95] tracking-[-0.035em]">
            Search the collection
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted">
            Explore clothing, shoes, bags and accessories from our current catalogue.
          </p>

          <form action="/search" method="get" role="search" className="mt-8 flex max-w-2xl border-b border-foreground">
            <label htmlFor="catalogue-search" className="sr-only">Search products</label>
            <input
              id="catalogue-search"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={120}
              placeholder="Search products, colours or styles"
              className="min-w-0 flex-1 bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Search products"
              className="flex w-12 items-center justify-center text-foreground transition-opacity hover:opacity-60"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </form>
        </div>

        {failed ? (
          <div className="py-20 text-center">
            <h2 className="font-serif text-3xl">The collection is unavailable</h2>
            <p className="mt-3 text-sm text-muted">Please try your search again shortly.</p>
            <Link href={searchHref(query)} className="mt-6 inline-block border-b border-foreground pb-1 text-xs tracking-widest uppercase">
              Try again
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 py-7">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-muted uppercase">
                  {query ? "Search results" : "All products"}
                </p>
                <p className="mt-1 font-serif text-2xl">
                  {query ? `“${query}”` : "The collection"}
                </p>
              </div>
              <p className="text-xs text-muted">
                {filtered.length} {filtered.length === 1 ? "product" : "products"}
              </p>
            </div>

            {categories.length > 1 ? (
              <nav aria-label="Filter by category" className="mb-9 flex gap-2 overflow-x-auto pb-2">
                {["All", ...categories].map((item) => {
                  const active = item === "All" ? !category : item === category;
                  return (
                    <Link
                      key={item}
                      href={searchHref(query, item === "All" ? undefined : item)}
                      aria-current={active ? "page" : undefined}
                      className={`shrink-0 border px-4 py-2 text-[11px] tracking-[0.08em] uppercase ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground"
                      }`}
                    >
                      {item}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {shown.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-14">
                {shown.map((product) => (
                  <ResultCard key={product.product_id} product={product} />
                ))}
              </div>
            ) : (
              <div className="border-t border-border py-20 text-center">
                <h2 className="font-serif text-3xl">No products found</h2>
                <p className="mt-3 text-sm text-muted">
                  Try a broader term, another colour or a product category.
                </p>
                <Link href="/search" className="mt-6 inline-block border-b border-foreground pb-1 text-xs tracking-widest uppercase">
                  Browse all products
                </Link>
              </div>
            )}

            {pageCount > 1 ? (
              <nav aria-label="Search result pages" className="mt-16 flex items-center justify-center gap-6 border-t border-border pt-8 text-xs">
                {page > 1 ? (
                  <Link href={searchHref(query, category, page - 1)} className="underline underline-offset-4">Previous</Link>
                ) : <span className="text-muted">Previous</span>}
                <span>Page {page} of {pageCount}</span>
                {page < pageCount ? (
                  <Link href={searchHref(query, category, page + 1)} className="underline underline-offset-4">Next</Link>
                ) : <span className="text-muted">Next</span>}
              </nav>
            ) : null}
          </>
        )}
      </Container>
    </div>
  );
}
