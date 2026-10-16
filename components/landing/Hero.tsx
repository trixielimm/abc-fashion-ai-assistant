import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";

export function Hero() {
  return (
    <section className="pt-6 lg:pt-8">
      <Container>
        <div className="grid overflow-hidden lg:grid-cols-[minmax(0,1.85fr)_minmax(280px,0.82fr)]">
          <div className="relative min-h-[340px] bg-[#d7d4cf] sm:min-h-[420px] lg:min-h-[600px]">
            <Image
              src="/images/hero.jpg"
              alt="Model in a long wool coat"
              fill
              priority
              sizes="(max-width: 1024px) 100vw"
              className="object-cover object-[center_30%]"
            />
            {/* Anchors the masthead without putting a shadow on the letters. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top_right,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.26)_38%,transparent_68%)]"
            />
            <div className="absolute bottom-8 left-6 text-[#f7f3ec] sm:bottom-12 sm:left-10 lg:bottom-16 lg:left-14">
              <p className="font-serif text-6xl leading-[0.82] italic lg:text-[92px]">
                VOLUME
              </p>
              <p className="mt-1 font-serif text-2xl leading-none italic lg:text-[28px]">
                One
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-surface px-6 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
            <p className="text-[11px] tracking-[0.28em] text-foreground uppercase">
              Autumn | Winter 2024
            </p>
            <h1 className="mt-6 font-serif text-[34px] leading-[1.15] italic lg:text-[36px]">
              Refined Simplicity in Every Thread.
            </h1>
            <p className="mt-5 max-w-[36ch] text-[13px] leading-6 text-muted">
              For those who believe that true style is found in the details and
              in the quality of materials.
            </p>
            <div className="mt-5">
              <Button href="#this-season">Shop New Arrivals →</Button>
            </div>
            <Button variant="ghost" href="#featured-categories" className="mt-5 w-fit">
              See more
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
