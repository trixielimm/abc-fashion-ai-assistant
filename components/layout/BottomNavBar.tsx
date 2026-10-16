"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import {
  GridIcon,
  HomeIcon,
  PersonIcon,
  ShoppingBagIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import { useStylist } from "@/components/stylist/StylistProvider";
import { cn } from "@/lib/cn";
import { useCartCount } from "@/lib/use-cart-count";

type NavItem = {
  label: string;
  href: string;
  Icon: (props: { className?: string }) => ReactElement;
  badge?: number;
};

const leadingItems: NavItem[] = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Shop", href: "/search", Icon: GridIcon },
];

const labelClass = "text-[10px] leading-none tracking-[0.05em] uppercase";

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const { label, href, Icon, badge } = item;

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={badge !== undefined ? `${label}, ${badge} ${badge === 1 ? "item" : "items"}` : undefined}
        className="flex h-16 flex-col items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
      >
        <span className={cn("relative", active ? "text-foreground" : "text-[#444444]")}>
          <Icon className="h-5 w-5" />
          {badge ? (
            <span className="absolute -top-[7px] -right-[7px] flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] leading-none font-semibold text-background ring-2 ring-panel">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            labelClass,
            active ? "font-semibold text-foreground" : "text-muted",
          )}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}

export function BottomNavBar() {
  const pathname = usePathname();
  const { openStylist } = useStylist();
  const count = useCartCount();

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {leadingItems.map((item) => (
          <NavTab key={item.label} item={item} active={pathname === item.href} />
        ))}

        <li>
          <button
            type="button"
            onClick={openStylist}
            className="flex h-16 w-full flex-col items-center justify-center gap-1.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
          >
            <span className="flex h-7 w-9 items-center justify-center rounded-[8px] bg-foreground text-background">
              <SparkleIcon className="h-5 w-5" />
            </span>
            <span className={cn(labelClass, "font-semibold")}>Stylist</span>
          </button>
        </li>

        <NavTab item={{ label: "Bag", href: "/cart", Icon: ShoppingBagIcon, badge: count }} active={pathname === "/cart"} />
        <li>
          <button type="button" disabled aria-label="Account coming soon" className="flex h-16 w-full flex-col items-center justify-center gap-1.5 text-muted">
            <span className="relative">
              <PersonIcon className="h-5 w-5" />
              <span className="absolute -top-1 -right-4 bg-panel text-[7px] uppercase">Soon</span>
            </span>
            <span className={labelClass}>Account</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
