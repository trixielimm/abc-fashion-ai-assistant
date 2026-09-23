"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/layout/Container";
import { useStylist } from "@/components/stylist/StylistProvider";
import { IconButton } from "@/components/ui/IconButton";
import {
  BagIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import { navLinks } from "@/lib/mock-data";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openStylist } = useStylist();

  return (
    <header className="relative border-b border-border bg-background">
      <Container className="flex h-[72px] items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            priority
            aria-hidden
            className="h-8 w-8 shrink-0"
          />
          <span className="font-serif text-[22px] italic leading-none tracking-tight">
            ABC Fashion
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-7 lg:flex" aria-label="Primary">
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

        <div className="ml-auto flex items-center gap-2.5">
          <form
            action="#this-season"
            className="relative hidden h-9 w-[168px] items-center md:flex"
            role="search"
          >
            <SearchIcon className="pointer-events-none absolute left-3 text-foreground" />
            <input
              type="search"
              name="q"
              placeholder="SEARCH"
              aria-label="Search"
              className="h-9 w-full rounded-full border border-[#d0d0d0] bg-background py-0 pr-4 pl-9 text-[10px] tracking-[0.16em] text-foreground outline-none placeholder:text-muted"
            />
          </form>
          <IconButton href="#" label="Account">
            <UserIcon />
          </IconButton>
          <IconButton href="/cart" label="Bag">
            <BagIcon />
          </IconButton>
          <IconButton
            label={menuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
        </div>
      </Container>

      {menuOpen ? (
        <div className="border-t border-border bg-background lg:hidden">
          <Container className="flex flex-col gap-5 py-6">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[15px]"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="w-fit cursor-pointer bg-foreground px-3.5 py-2 text-[10px] tracking-[0.18em] text-background uppercase"
              onClick={() => {
                setMenuOpen(false);
                openStylist();
              }}
            >
              AI Stylist
            </button>
            <form action="#this-season" className="relative md:hidden" role="search">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
              <input
                type="search"
                name="q"
                placeholder="SEARCH"
                aria-label="Search"
                className="h-10 w-full rounded-full border border-[#d0d0d0] pr-4 pl-9 text-[10px] tracking-[0.16em] outline-none placeholder:text-muted"
              />
            </form>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
