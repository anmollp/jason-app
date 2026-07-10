import { Button } from "@/components/ui/Button";

import { ProductPreview } from "./ProductPreview";
import { ProofStrip } from "./ProofStrip";

const githubUrl = "https://github.com/anmollp/jason-app";

export function HeroSection() {
  return (
    <section className="grid items-center gap-12 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(440px,570px)] lg:py-[90px] xl:gap-14">
      <div className="min-w-0">
        <p className="mb-8 font-mono text-sm text-zinc-400">
          Built for API payloads
        </p>
        <h1 className="max-w-full text-5xl font-bold leading-[1.08] tracking-tight md:text-[66px]">
          Jason JSON Workspace
        </h1>
        <p className="mt-7 max-w-full text-xl leading-8 text-zinc-400 xl:max-w-[590px]">
          Format messy payloads, compare snapshots, apply JSON Patch operations,
          and resolve Pointer paths without leaving one focused playground.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Button href="/playground">Try Jason</Button>
          <Button href={githubUrl} target="_blank" rel="noreferrer" variant="ghost">
            GitHub
          </Button>
        </div>

        <ProofStrip />
      </div>

      <ProductPreview />
    </section>
  );
}
