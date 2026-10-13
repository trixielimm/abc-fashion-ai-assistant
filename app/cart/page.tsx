"use client";

import { useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { CartItem } from "@/components/cart/CartItem";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { useStylist } from "@/components/stylist/StylistProvider";
import { CART_UPDATED_EVENT, readCart, writeCart, type CartRow, type StoredCartItem, } from "@/lib/cart";
import { featuredProducts, formatPrice, } from "@/lib/mock-data";
import { getProductImageEndpoint } from "@/lib/product-image";

const recommendations = featuredProducts.slice(0, 4);

// Updates the cart when it changes in this tab or another tab.
function subscribeToCart(onChange: () => void) {
  window.addEventListener(CART_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Reads the current cart as text so React can detect changes.
function getCartSnapshot() {
  return JSON.stringify(readCart());
}

function getServerCartSnapshot() {
  return null;
}

export default function CartPage() {
  const { openStylist } = useStylist();

  const snapshot = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );

  const ready = snapshot !== null;

  const items = useMemo<StoredCartItem[]>(
    () => (snapshot ? JSON.parse(snapshot) : []),
    [snapshot],
  );

  const rows: CartRow[] = items.flatMap((item) => {
    const product = featuredProducts.find(
      (p) => p.id === item.productId,
    );

    const name = product?.name ?? item.name;
    const price = product?.price ?? item.price;

    if (!name || price === undefined) return [];

    return [{
      ...item,
      name,
      price,
      image: product?.image ?? item.image ?? getProductImageEndpoint(item.productId),
      href: product?.href ?? `/products/${encodeURIComponent(item.productId)}`,
    }];
  });

  const count = rows.reduce(
    (sum, row) => sum + row.quantity,
    0,
  );

  const subtotal = rows.reduce(
    (sum, row) => sum + row.price * row.quantity,
    0,
  );

  function update(
    productId: string,
    size: string,
    quantity: number,
  ) {
    const updated = items.flatMap((item) => {
      if (
        item.productId !== productId ||
        item.size !== size
      ) {
        return [item];
      }

      return quantity > 0
        ? [{ ...item, quantity }]
        : [];
    });

    writeCart(updated);
  }

  return (
    <Container className="pb-24 pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-4xl sm:text-5xl">
            Shopping Cart
          </h1>

          <span className="text-[10px] uppercase tracking-widest text-muted">
            ({count} selected{" "}
            {count === 1 ? "item" : "items"})
          </span>
        </div>

        <Link
          href="/"
          className="text-[10px] uppercase tracking-widest underline underline-offset-4"
        >
          Continue browsing collection
        </Link>
      </div>

      {!ready ? (
        <p className="py-10 text-sm text-muted">
          Loading bag…
        </p>
      ) : rows.length === 0 ? (
        <div className="py-16">
          <p className="font-serif text-2xl">
            Your bag is empty
          </p>

          <Link
            href="/"
            className="mt-5 inline-block border-b border-black pb-1 text-xs uppercase tracking-widest"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <div>
            {rows.map((row) => (
              <CartItem
                key={`${row.productId}:${row.size}`}
                row={row}
                onQuantityChange={(quantity) =>
                  update(
                    row.productId,
                    row.size,
                    quantity,
                  )
                }
                onRemove={() =>
                  update(row.productId, row.size, 0)
                }
              />
            ))}

            <div className="mt-6 flex flex-wrap justify-between gap-4 text-xs text-muted">
              <span className="flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Items reserved in cart for 20 minutes
              </span>

              <button
                type="button"
                onClick={openStylist}
                className="text-left underline underline-offset-4 hover:text-foreground"
              >
                Need personal styling advice? Contact Customer Concierge
              </button>
            </div>
          </div>

          <div className="pt-7">
            <OrderSummary
              count={count}
              subtotal={subtotal}
            />
          </div>
        </div>
      )}

      <section
        className="mt-20 border-t border-border pt-14"
        aria-labelledby="cart-recommendations"
      >
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2
            id="cart-recommendations"
            className="font-serif text-3xl"
          >
            Curated to Pair With Your Selection
          </h2>

          <Link
            href="/"
            className="text-[10px] uppercase tracking-widest"
          >
            View all essentials
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {recommendations.map((product) => (
            <Link
              href={product.href}
              key={product.id}
              className="group"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-surface">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>

              <p className="mt-3 text-[10px] uppercase tracking-widest text-muted">
                ABC Fashion
              </p>
              <h3 className="font-serif text-lg">
                {product.name}
              </h3>
              <p className="text-xs">
                {formatPrice(product.price)} AUD
              </p>
            </Link>
          ))}
        </div>
      </section>
    </Container>
  );
}
