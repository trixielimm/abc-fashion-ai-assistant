"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useTransition, type ReactNode } from "react";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

const SearchNavigationContext = createContext<((href: string) => void) | null>(null);

export function SearchResults({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const resultsRef = useRef<HTMLDivElement>(null);

  function navigate(href: string) {
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    startTransition(async () => {
      router.push(href, { scroll: false });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
    });
  }

  return (
    <SearchNavigationContext.Provider value={navigate}>
      <div ref={resultsRef} aria-busy={pending} className="relative scroll-mt-24">
        {children}
        {pending ? (
          <div className="absolute inset-0 z-20 bg-background/85 backdrop-blur-sm">
            <LoadingScreen contained />
          </div>
        ) : null}
      </div>
    </SearchNavigationContext.Provider>
  );
}

export function SearchPageLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const navigate = useContext(SearchNavigationContext);

  return (
    <Link
      href={href}
      className="underline underline-offset-4"
      onNavigate={(event) => {
        if (!navigate) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </Link>
  );
}
