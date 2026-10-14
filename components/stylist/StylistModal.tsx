"use client";

import { useEffect, useRef, useState } from "react";
import { StylistChat } from "@/components/stylist/StylistChat";

type StylistModalProps = {
  open: boolean;
  onClose: () => void;
};

export function StylistModal({
  open,
  onClose,
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

    const previousBodyOverflow = document.body.style.overflow;
    const previousPageOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousPageOverflow;
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
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(920px,calc(100vw-2rem))] overflow-clip overscroll-none border border-hairline bg-background p-0 text-foreground backdrop:bg-black/40"
    >
      <StylistChat
        key={chatVersion}
        onClose={onClose}
        onReset={() => setChatVersion((version) => version + 1)}
      />
    </dialog>
  );
}
