"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewedPageContext } from "@/lib/stylist/viewedProduct";
import { StylistChat } from "@/components/stylist/StylistChat";

type StylistModalProps = {
  open: boolean;
  onClose: () => void;
  viewedPage: ViewedPageContext | null;
};

export function StylistModal({
  open,
  onClose,
  viewedPage,
}: StylistModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chatVersion, setChatVersion] = useState(0);

  // A native dialog gives us the focus trap, Escape handling and inert
  // background for free; we only mirror the open state onto it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="AI Stylist"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(920px,calc(100vw-2rem))] border border-hairline bg-background p-0 text-foreground backdrop:bg-black/40"
    >
      <StylistChat
        key={chatVersion}
        viewedPage={viewedPage}
        onClose={onClose}
        onReset={() => setChatVersion((version) => version + 1)}
      />
    </dialog>
  );
}
