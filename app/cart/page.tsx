"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { CartItem } from "@/components/cart/CartItem";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { useStylist } from "@/components/stylist/StylistProvider";
import { readCart, subscribeToCart, writeCart, getCartExpiresAt, type CartRow, type StoredCartItem } from "@/lib/cart";
import { featuredProducts } from "@/lib/mock-data";
import { formatPrice } from "@/lib/format-price";
import { getProductImageEndpoint } from "@/lib/product-image";


const recommendations = featuredProducts.slice(0, 4);

// Reads the current cart as text so React can detect changes.
function getCartSnapshot() {
  return JSON.stringify(readCart());
}

function getServerCartSnapshot() {
  return null;
}

export default function CartPage() {
  const { openStylist } = useStylist();
  const [cartError, setCartError] = useState("");
  const [remainingSeconds, setRemainingSeconds] =
  useState<number | null>(null);

  const [cartExpired, setCartExpired] = useState(false);

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

  useEffect(() => {
    function tick() {
      const expiresAt = getCartExpiresAt();

      if (expiresAt === null) {
        setRemainingSeconds(null);
        return;
      }

      const remaining = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );

      setRemainingSeconds(remaining);

      if (remaining === 0) {
        setCartExpired(true);

        try {
          writeCart([]);
        } catch {
          setCartError("Could not clear your expired bag.");
        }
      } else {
        setCartExpired(false);
      }
    }

    tick();

    const intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [snapshot]);

  const countdown =
    remainingSeconds === null
      ? null
      : `${Math.floor(remainingSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(remainingSeconds % 60)
          .toString()
          .padStart(2, "0")}`;

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

  function getMaxQuantity(row: CartRow): number | null {
    const sameProduct = items.filter(
      (item) => item.productId === row.productId,
    );

    const otherSizesQuantity = sameProduct.reduce(
      (total, item) =>
        item.size === row.size
          ? total
          : total + item.quantity,
      0,
    );

    const limits: number[] = [];

    if (row.sizeStock != null) {
      limits.push(row.sizeStock);
    }

    for (const item of sameProduct) {
      if (item.productStock != null) {
        limits.push(
          Math.max(0, item.productStock - otherSizesQuantity),
        );
      }
    }

    return limits.length > 0 ? Math.min(...limits) : null;
  }

  function update(
    productId: string,
    size: string,
    quantity: number,
  ) {
    setCartError("");

    if (!Number.isInteger(quantity) || quantity < 0) {
      setCartError("Quantity must be a whole number of 0 or more.");
      return;
    }

    try {
      const current = readCart();

      const updated = current.flatMap((item) => {
        if (
          item.productId !== productId ||
          item.size !== size
        ) {
          return [item];
        }

        return quantity === 0
          ? []
          : [{ ...item, quantity }];
      });

      writeCart(updated);
    } catch (error) {
      setCartError(
        error instanceof Error
          ? error.message
          : "Could not update your bag. Please try again.",
      );
    }
  }

  return (
    <Container className="pb-24 pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
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
       {cartError && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-700"
        >
          {cartError}
        </p>
      )}

      {ready && rows.length > 0 && countdown !== null && (
        <p className="mb-1 mt-3 text-[11px] text-muted">
          Bag clears in{" "}
          <span className="tabular-nums">{countdown}</span>
          <span className="mx-2" aria-hidden="true">·</span>
          Items are not reserved.
        </p>
      )}
      {cartExpired && (
        <p role="status" className="mt-3 text-xs text-muted">
          Your bag expired after 20 minutes. Please add your items again.
        </p>
      )}
      
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
                maxQuantity={getMaxQuantity(row)}
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
                Your bag is saved on this device
              </span>

              <button
                type="button"
                onClick={openStylist}
                className="text-left underline underline-offset-4 hover:text-foreground"
              >
                Need styling advice? Ask the AI Stylist
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
        <div className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
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
