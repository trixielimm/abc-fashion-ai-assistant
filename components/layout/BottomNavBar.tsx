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
import { bagItemCount } from "@/lib/mock-data";

type NavItem = {
  label: string;
  href: string;
  Icon: (props: { className?: string }) => ReactElement;
  badge?: number;
};

const leadingItems: NavItem[] = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Shop", href: "#this-season", Icon: GridIcon },
];

const trailingItems: NavItem[] = [
  { label: "Bag", href: "/cart", Icon: ShoppingBagIcon, badge: bagItemCount },
  { label: "Account", href: "#", Icon: PersonIcon },
];

const labelClass = "text-[10px] leading-none tracking-[0.05em] uppercase";

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const { label, href, Icon, badge } = item;

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={badge ? `${label}, ${badge} items` : undefined}
        className="flex h-[52px] flex-col items-center pt-[15px]"
      >
        <span className={cn("relative", active ? "text-foreground" : "text-[#444444]")}>
          <Icon className="h-5 w-5" />
          {badge ? (
            <span className="absolute -top-[7px] -right-[7px] flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] leading-none font-semibold text-background ring-2 ring-panel">
              {badge}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            labelClass,
            "mt-[4px]",
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
            className="flex h-[52px] w-full flex-col items-center text-foreground"
          >
            <span className="-mt-[17px] flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground text-background ring-4 ring-panel">
              <SparkleIcon className="h-5 w-5" />
            </span>
            <span className={cn(labelClass, "mt-2 font-semibold")}>Stylist</span>
          </button>
        </li>

        {trailingItems.map((item) => (
          <NavTab key={item.label} item={item} active={pathname === item.href} />
        ))}
      </ul>
    </nav>
  );
}
