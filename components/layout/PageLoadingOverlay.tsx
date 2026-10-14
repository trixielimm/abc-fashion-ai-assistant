"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return <LoadingCycle key={`${pathname}?${searchParams.toString()}`} />;
}

export function PageLoadingOverlay() {
  return (
    <Suspense fallback={<LoadingScreen overlay />}>
      <RouteLoadingOverlay />
    </Suspense>
  );
}
