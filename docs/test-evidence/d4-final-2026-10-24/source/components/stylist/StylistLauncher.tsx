"use client";

import { useStylist } from "@/components/stylist/StylistProvider";
import { ChatIcon } from "@/components/ui/icons";

// Desktop-only: on smaller screens the bottom nav already carries a Stylist tab,
// and a floating button would sit on top of it.
export function StylistLauncher() {
  const { openStylist } = useStylist();

  return (
    <button
      type="button"
      onClick={openStylist}
      className="fixed right-6 bottom-6 z-40 hidden items-center gap-3 bg-foreground px-6 py-4 text-[11px] font-medium tracking-[0.18em] text-background uppercase shadow-[0_4px_18px_rgba(0,0,0,0.16)] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:inline-flex"
    >
      <ChatIcon className="h-[14px] w-[14px]" />
      Chat with stylist
    </button>
  );
}
