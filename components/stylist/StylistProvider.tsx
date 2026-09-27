"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { StylistModal } from "@/components/stylist/StylistModal";

type StylistContextValue = {
  openStylist: () => void;
};

const StylistContext = createContext<StylistContextValue | null>(null);

export function useStylist() {
  const context = useContext(StylistContext);

  if (!context) {
    throw new Error("useStylist must be used within a StylistProvider");
  }

  return context;
}

export function StylistProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(() => ({ openStylist: () => setOpen(true) }), []);

  return (
    <StylistContext.Provider value={value}>
      {children}
      <StylistModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </StylistContext.Provider>
  );
}
