import { Button } from "@/components/ui/Button";

import { ProductPreview } from "./ProductPreview";
import { ProofStrip } from "./ProofStrip";

export function HeroSection() {
  return (
    <section className="grid items-center gap-12 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(440px,570px)] lg:py-[90px] xl:gap-14">
      <div className="min-w-0">
        <p className="mb-8 font-mono text-sm text-zinc-400">
          JSON tools for builders
        </p>
        <h1 className="max-w-full text-5xl font-bold leading-[1.08] tracking-tight md:text-[66px]">
          Understand JSON before it bites production.
        </h1>
        <p className="mt-7 max-w-full text-xl leading-8 text-zinc-400 xl:max-w-[590px]">
          Jason formats, diffs, patches, and explains structured data in one
          focused workspace for API teams.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Button>Try Jason</Button>
          <Button variant="secondary">View Docs</Button>
          <Button variant="ghost">GitHub</Button>
        </div>

        <ProofStrip />
      </div>

      <ProductPreview />
    </section>
  );
}
