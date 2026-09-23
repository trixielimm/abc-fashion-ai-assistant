import Image from "next/image";
import { Button } from "@/components/ui/Button";

export function CampaignBanner() {
  return (
    <section className="mt-8 grid lg:grid-cols-2">
      <div className="flex min-h-[420px] flex-col justify-center bg-foreground px-8 py-16 text-background sm:px-12 lg:min-h-[560px] lg:px-20">
        <p className="text-[10px] tracking-[0.28em] uppercase">Campaign 04</p>
        <h2 className="mt-6 max-w-[10ch] font-serif text-5xl leading-[0.95] italic uppercase lg:text-[64px]">
          The Modernist Dialogue
        </h2>
        <p className="mt-8 max-w-[38ch] text-[13px] leading-6 text-white/75">
          A conversation between architecture and attire. Our latest campaign
          explores the intersection of sculpted forms and fluid silhouettes,
          captured in the heart of Copenhagen&apos;s modernist landscape.
        </p>
        <Button variant="onDark" href="#" className="mt-10 w-fit">
          Read the story →
        </Button>
      </div>
      <div className="relative min-h-[320px] lg:min-h-full">
        <Image
          src="/images/campaign.jpg"
          alt="Campaign models photographed against concrete architecture"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
