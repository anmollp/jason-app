import Link from "next/link";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "./InspectorPanel";
import { JasonStatus } from "./JasonStatus";
import { ToolTabs } from "./ToolTabs";

const inputJson = `{
  "service": "billing",
  "region": "us-east-1",
  "retry": true
}`;

const outputJson = `{
  "region": "us-east-1",
  "retry": true,
  "service": "billing"
}`;

export function PlaygroundShell() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <JasonLogo size={34} />
            <span className="font-mono text-xl font-semibold">Jason</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button href="/" variant="secondary" className="hidden sm:inline-flex">
              Landing
            </Button>
            <Button
              href="https://github.com/anmollp/jason"
              variant="secondary"
              className="hidden sm:inline-flex"
            >
              GitHub
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold uppercase text-emerald-400">
              JSON workspace
            </p>
            <h1 className="mt-3 max-w-[760px] text-4xl font-bold tracking-tight sm:text-5xl">
              Format, diff, patch, and inspect JSON.
            </h1>
          </div>
          <JasonStatus />
        </section>

        <ToolTabs />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
          <CodePanel title="Input JSON" meta="input" code={inputJson} />
          <CodePanel
            title="Formatted Output"
            meta="formatted"
            code={outputJson}
            tone="success"
          />
          <InspectorPanel />
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-zinc-400">
            Ready state: Jason confirms valid JSON, then keeps actions close to
            the result.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button>Format</Button>
            <Button variant="secondary">Copy</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
