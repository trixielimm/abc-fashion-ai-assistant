import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/supabase/env";

async function getCatalogStatus() {
  if (!hasEnvVars) {
    return {
      ok: false,
      message:
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      productCount: 0,
      categoryCount: 0,
    };
  }

  try {
    const supabase = await createClient();
    const [products, categories] = await Promise.all([
      supabase
        .from("product_catalog")
        .select("product_id", { count: "exact", head: true }),
      supabase
        .from("categories")
        .select("category_id", { count: "exact", head: true }),
    ]);


    if (products.error) {
      return {
        ok: false,
        message: products.error.message,
        productCount: 0,
        categoryCount: 0,
      };
    }

    if (categories.error) {
      return {
        ok: false,
        message: categories.error.message,
        productCount: 0,
        categoryCount: 0,
      };
    }

    return {
      ok: true,
      message: "Public catalog is readable",
      productCount: products.count ?? 0,
      categoryCount: categories.count ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown connection error",
      productCount: 0,
      categoryCount: 0,
    };
  }
}

export default async function Home() {
  const status = await getCatalogStatus();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          ABC Fashion
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          AI Assistant
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          The product catalog is public. Anyone can browse; writes stay off the
          public API.
        </p>

        <dl className="mt-8 space-y-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-500">Catalog</dt>
            <dd
              className={
                status.ok
                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                  : "font-medium text-red-700 dark:text-red-400"
              }
            >
              {status.ok ? "Readable" : "Error"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-500">Categories</dt>
            <dd className="text-zinc-800 dark:text-zinc-200">
              {status.categoryCount}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-500">Available products</dt>
            <dd className="text-zinc-800 dark:text-zinc-200">
              {status.productCount}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-right text-zinc-800 dark:text-zinc-200">
              {status.message}
            </dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
