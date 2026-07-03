import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/NavBar";
import { Button } from "@/components/ui/Button";

function ProductPreview() {
  return (
    <section
      aria-label="JSON diff workspace preview"
      className="relative overflow-hidden rounded-[28px] border border-zinc-700 bg-zinc-900 shadow-[0_28px_70px_rgba(0,0,0,0.42)]"
    >
      <div className="flex h-[60px] items-center justify-between border-b border-zinc-800 bg-zinc-800/80 px-5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="ml-5 font-mono text-xs font-semibold text-zinc-400">
            diff / response.json
          </span>
        </div>
        <span className="font-mono text-xs font-semibold text-emerald-400">
          2 changes
        </span>
      </div>

      <div className="flex gap-2 px-6 pt-5 font-mono text-xs font-semibold">
        {["Diff", "Format", "Patch", "Pointer"].map((tab, index) => (
          <span
            key={tab}
            className={`rounded-lg px-3 py-2 ${
              index === 0
                ? "border border-zinc-700 bg-zinc-800 text-zinc-50"
                : "text-zinc-500"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <CodePane
          label="before"
          code={`{
  "status": "draft",
  "plan": "starter",
  "user": {
    "role": "viewer"
  }
}`}
        />
        <CodePane
          label="after"
          changed
          code={`{
  "status": "ready",
  "plan": "pro",
  "user": {
    "role": "admin"
  }
}`}
        />
      </div>

      <div className="mx-6 mb-6 flex items-center justify-between rounded-2xl border border-zinc-700 bg-zinc-800 p-5">
        <div>
          <h3 className="font-mono text-sm font-semibold text-zinc-50">
            Review summary
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Status, plan, and permissions changed in this payload.
          </p>
        </div>
        <span className="font-mono text-xs font-semibold text-emerald-400">
          Inspect path
        </span>
      </div>
    </section>
  );
}

function CodePane({
  label,
  code,
  changed = false,
}: {
  label: string;
  code: string;
  changed?: boolean;
}) {
  return (
    <article className="min-h-[286px] rounded-[18px] border border-zinc-800 bg-[#09090B] p-5">
      <div className="mb-5 font-mono text-xs font-semibold text-zinc-500">
        {label}
      </div>
      <pre
        className={`overflow-hidden rounded-lg font-mono text-sm leading-6 ${
          changed
            ? "bg-[linear-gradient(transparent_48px,rgba(16,185,129,.16)_48px,rgba(16,185,129,.16)_76px,transparent_76px,transparent_94px,rgba(56,189,248,.12)_94px,rgba(56,189,248,.12)_122px,transparent_122px,transparent_190px,rgba(124,58,237,.16)_190px,rgba(124,58,237,.16)_218px,transparent_218px)] text-zinc-50"
            : "text-zinc-400"
        }`}
      >
        <code>{code}</code>
      </pre>
    </article>
  );
}

const proofItems = [
  ["4 modes", "format, diff, patch, pointer"],
  ["0 setup", "paste JSON and inspect"],
  ["dev first", "keyboard-friendly surfaces"],
];

const features = [
  ["01", "Formatter", "Clean up pasted payloads without losing structure.", "bg-sky-400"],
  ["02", "Diff", "Compare snapshots with readable change groups.", "bg-emerald-500"],
  ["03", "Patch", "Generate patch-ready edits from reviewed changes.", "bg-violet-600"],
  ["04", "Pointer", "Jump to nested paths and share exact references.", "bg-amber-500"],
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#09090B] text-zinc-50">
      <div className="pointer-events-none absolute right-20 top-0 size-[520px] rounded-full bg-emerald-500/15 blur-sm" />
      <div className="pointer-events-none absolute right-24 top-[430px] size-[380px] rounded-full bg-sky-400/10 blur-sm" />

      <div className="relative mx-auto w-full max-w-[1440px] px-6 py-9 lg:px-10 xl:px-[72px] 2xl:px-[110px]">
        <Navbar />

        <main>
          <section className="grid items-center gap-12 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(440px,570px)] lg:py-[90px] xl:gap-14">
            <div className="min-w-0">
              <p className="mb-8 font-mono text-sm text-zinc-400">
                JSON tools for builders
              </p>
              <h1 className="max-w-full text-5xl font-bold leading-[1.08] tracking-tight md:text-[66px]">
                Understand JSON before it bites production.
              </h1>
              <p className="mt-7 max-w-full text-xl leading-8 text-zinc-400 xl:max-w-[590px]">
                Jason formats, diffs, patches, and explains structured data in
                one focused workspace for API teams.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <Button>Try Jason</Button>
                <Button variant="secondary">View Docs</Button>
                <Button variant="ghost">GitHub</Button>
              </div>

              <div className="mt-20 grid max-w-[540px] grid-cols-3 rounded-[20px] border border-zinc-800 bg-zinc-900">
                {proofItems.map(([value, label], index) => (
                  <div
                    key={value}
                    className={`p-5 ${index > 0 ? "border-l border-zinc-800" : ""}`}
                  >
                    <div className="font-mono text-sm font-semibold text-zinc-50">
                      {value}
                    </div>
                    <div className="mt-2 text-xs leading-4 text-zinc-500">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ProductPreview />
          </section>

          <section id="features" className="py-10">
            <p className="mb-5 font-mono text-sm text-zinc-500">
              Core workflow
            </p>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
              Four focused tools, one tidy interface.
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map(([number, title, body, colorClass]) => (
                <article
                  key={title}
                  className="min-h-[206px] rounded-[22px] border border-zinc-800 bg-zinc-900 p-6"
                >
                  <div
                    className={`grid size-11 place-items-center rounded-[13px] font-mono text-xs font-black text-white ${colorClass}`}
                  >
                    {number}
                  </div>
                  <h3 className="mt-7 font-mono text-lg font-semibold">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section
            id="workflow"
            className="mt-10 grid gap-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 md:grid-cols-[1fr_1.1fr]"
          >
            <div>
              <p className="mb-4 font-mono text-sm text-zinc-500">Workflow</p>
              <h2 className="max-w-xl text-3xl font-bold leading-tight md:text-4xl">
                Paste JSON. Compare changes. Share the exact path.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                ["Paste", "Drop in a response or config."],
                ["Compare", "Separate structure from noise."],
                ["Share", "Copy pointer or patch."],
              ].map(([title, body]) => (
                <div key={title}>
                  <h3 className="font-mono text-sm font-semibold text-zinc-50">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
