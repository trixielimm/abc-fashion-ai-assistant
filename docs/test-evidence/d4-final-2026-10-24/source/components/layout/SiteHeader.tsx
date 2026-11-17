"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { CartIndicator } from "@/components/commerce/CartIndicator";
import { useStylist } from "@/components/stylist/StylistProvider";
import { IconButton } from "@/components/ui/IconButton";
import {
  BagIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { navLinks } from "@/lib/navigation";
import { useCartCount } from "@/lib/use-cart-count";

function ProductSearch({ className }: { className: string }) {
  return <form action="/search" method="get" className={`relative h-11 items-center ${className}`} role="search" aria-label="Product search">
    <button type="submit" aria-label="Search products" className="absolute left-0 flex h-11 w-11 items-center justify-center">
      <SearchIcon className="text-foreground" />
    </button>
    <input type="search" name="q" maxLength={120} placeholder="Search products" aria-label="Search"
      className="h-11 w-full rounded-full border border-[#d0d0d0] bg-background py-0 pr-4 pl-11 text-base text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-foreground md:text-sm" />
  </form>;
}

export function SiteHeader() {
  const pathname = usePathname();
  return <HeaderContent key={pathname} />;
}

function HeaderContent() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openStylist } = useStylist();
  const count = useCartCount();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("mobile-menu-toggle")?.focus();
      }
    }
    if (menuOpen) window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="relative border-b border-border bg-background">
      <Container className="flex h-[72px] items-center gap-3 lg:gap-6">
        <Link href="/" onClick={() => setMenuOpen(false)} className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            priority
            aria-hidden
            className="h-8 w-8 shrink-0"
          />
          <span className="whitespace-nowrap font-serif text-[22px] italic leading-none tracking-tight">
            ABC Fashion
          </span>
        </Link>

        <nav className="hidden items-center gap-4 lg:flex xl:ml-4 xl:gap-7" aria-label="Primary">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[13px] text-foreground/90 transition-opacity hover:opacity-60"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openStylist}
            className="bg-foreground cursor-pointer px-3.5 py-2 text-[10px] font-medium tracking-[0.18em] text-background uppercase transition-opacity hover:opacity-80"
          >
            AI Stylist
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:gap-2.5">
          <ProductSearch className="hidden w-[200px] shrink-0 md:flex" />
          <IconButton compact href="/cart" label={`Bag, ${count} ${count === 1 ? "item" : "items"}`} onClick={() => setMenuOpen(false)}>
            <CartIndicator compact count={count}><BagIcon className="h-3.5 w-3.5" /></CartIndicator>
          </IconButton>
          <span role="status" aria-atomic="true" className="sr-only">
            {count ? `${count} ${count === 1 ? "item" : "items"} in your bag` : "Your bag is empty"}
          </span>
          <IconButton
            compact
            label={menuOpen ? "Close menu" : "Open menu"}
            id="mobile-menu-toggle"
            className="lg:hidden"
            expanded={menuOpen}
            controls="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </IconButton>
        </div>
      </Container>

      <Container className="pb-3 md:hidden">
        <ProductSearch className="flex w-full" />
      </Container>

      {menuOpen ? (
        <nav aria-label="Mobile menu" id="mobile-menu" className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-132px)] overflow-y-auto border-b border-t border-border bg-background shadow-lg lg:hidden">
          <Container className="flex flex-col gap-5 py-6">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-h-11 items-center text-[15px]"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="min-h-11 w-fit cursor-pointer bg-foreground px-3.5 py-2 text-[12px] tracking-[0.18em] text-background uppercase"
              onClick={() => {
                setMenuOpen(false);
                openStylist();
              }}
            >
              AI Stylist
            </button>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
