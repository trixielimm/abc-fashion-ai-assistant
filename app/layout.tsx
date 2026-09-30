import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { OverlayScrollbar } from "@/components/layout/OverlayScrollbar";
import { PageLoadingOverlay } from "@/components/layout/PageLoadingOverlay";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StylistLauncher } from "@/components/stylist/StylistLauncher";
import { StylistProvider } from "@/components/stylist/StylistProvider";
import { PendingStyleAction } from "@/components/style/PendingStyleAction";
import { SavedProductsProvider } from "@/components/style/SavedProductsProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "ABC Fashion",
  description:
    "Refined simplicity in every thread. Autumn Winter 2024 from ABC Fashion.",
  icons: {
    icon: "/logo.svg",
  },
};

// viewport-fit=cover so the bottom nav can pad itself with the iOS safe-area inset.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      id="page-scroll"
      lang="en"
      className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background pb-[calc(52px+env(safe-area-inset-bottom))] font-sans text-foreground lg:pb-0">
        <PageLoadingOverlay />
        <OverlayScrollbar />
        <noscript>
          <style>{".site-page-loader { display: none !important; }"}</style>
        </noscript>
        <SavedProductsProvider>
          <StylistProvider>
            <PendingStyleAction />
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <BottomNavBar />
            <StylistLauncher />
          </StylistProvider>
        </SavedProductsProvider>
      </body>
    </html>
  );
}
