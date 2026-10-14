"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

function PendingScreen() {
  const { pending } = useLinkStatus();

  return pending ? <LoadingScreen overlay /> : null;
}

export function SearchPageLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="underline underline-offset-4">
      {children}
      <PendingScreen />
    </Link>
  );
}
