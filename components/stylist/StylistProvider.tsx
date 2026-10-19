"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { usePathname } from "next/navigation";
import { StylistModal } from "./StylistModal";

import type {
  ViewedPageContext,
  ViewedProduct,
} from "@/lib/stylist/viewedProduct";

type StylistContextValue = {
  openStylist: () => void;
  registerViewedProduct: (product: ViewedProduct) => () => void;
};

const StylistContext =
  createContext<StylistContextValue | null>(null);

export function useStylist() {
  const context = useContext(StylistContext);

  if (!context) {
    throw new Error(
      "useStylist must be used within a StylistProvider"
    );
  }

  return context;
}

export function StylistProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const [registered, setRegistered] =
    useState<ViewedPageContext | null>(null);

  const nextKey = useRef(0);
  const pathname = usePathname();

  const openStylist = useCallback(() => setOpen(true), []);

  const registerViewedProduct = useCallback(
    (product: ViewedProduct) => {
      const key = ++nextKey.current;

      setRegistered({
        key,
        pathname: `/products/${encodeURIComponent(product.product_id)}`,
        product,
      });

      // An older page's cleanup must not erase a newer registration.
      return () => {
        setRegistered((current) =>
          current?.key === key ? null : current
        );
      };
    },
    []
  );

  const value = useMemo(
    () => ({ openStylist, registerViewedProduct }),
    [openStylist, registerViewedProduct]
  );

  // Do not expose an old page's product after navigation.
  const viewedPage =
    registered?.pathname === pathname
      ? registered
      : null;

  return (
    <StylistContext.Provider value={value}>
      {children}

      <StylistModal
        open={open}
        onClose={() => setOpen(false)}
        viewedPage={viewedPage}
      />
    </StylistContext.Provider>
  );
}