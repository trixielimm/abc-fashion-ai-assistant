"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

const MINIMUM_LOADING_MS = 600;

function LoadingCycle() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), MINIMUM_LOADING_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  return visible ? <LoadingScreen overlay /> : null;
}

export function PageLoadingOverlay() {
  const pathname = usePathname();

  return <LoadingCycle key={pathname} />;
}
