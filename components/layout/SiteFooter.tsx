import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import {
  footerConnect,
  footerDepartments,
  footerSocial,
  instagramImages,
} from "@/lib/mock-data";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <div>
          <p className="flex items-center gap-2 font-serif text-[15px] italic">
            <Image
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden
              className="h-[22px] w-[22px] shrink-0"
            />
            ABC Fashion
          </p>
          <p className="mt-6 text-[10px] leading-5 tracking-[0.16em] text-muted uppercase">
            Copenhagen &amp; Stockholm
            <br />
            London / Paris / New York
          </p>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            On Instagram
          </p>
          <div className="mt-4 grid max-w-[168px] grid-cols-2 gap-1.5">
            {instagramImages.map((image) => (
              <Link
                key={image.src}
                href="#"
                className="relative aspect-square overflow-hidden"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            Our Department
          </p>
          <ul className="mt-4 space-y-2.5">
            {footerDepartments.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-[12px] text-foreground/80 transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">
            Connect
          </p>
          <ul className="mt-4 space-y-2.5">
            {footerConnect.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-[12px] tracking-[0.08em] text-foreground/80 uppercase transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-2">
            {footerSocial.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-[11px] tracking-[0.16em] text-muted uppercase transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-border py-5 text-[10px] tracking-[0.14em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
        <div><p>© 2026 ABC Fashion Inc. All rights reserved.</p>
          <p className="mt-2 normal-case tracking-normal">Prototype store — sample products and AI-generated specifications.</p>
        </div>
        <p className="flex gap-4">
          <Link href="/terms-of-service" className="hover:text-foreground">
            AI Terms
          </Link>
          <Link href="/terms-of-service#privacy" className="hover:text-foreground">
            AI Privacy
          </Link>
          <Link href="#" className="hover:text-foreground">
            Cookies
          </Link>
        </p>
      </Container>
    </footer>
  );
}
