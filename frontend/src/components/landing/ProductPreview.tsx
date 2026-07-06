import { JasonMascot } from "@/components/mascot/JasonMascot";

import { CodePane } from "./CodePane";

const modes = ["Diff", "Format", "Patch", "Pointer"];

const beforeJson = `{
  "status": "draft",
  "plan": "starter",
  "user": {
    "role": "viewer"
  }
}`;

const afterJson = `{
  "status": "ready",
  "plan": "pro",
  "user": {
    "role": "admin"
  },
  "timeoutMs": 3000
}`;

const beforeHighlights = [
  { line: 2, marker: "~" as const, tone: "review" as const },
  { line: 3, marker: "~" as const, tone: "review" as const },
  { line: 5, marker: "~" as const, tone: "review" as const },
];

const afterHighlights = [
  { line: 2, marker: "~" as const, tone: "review" as const },
  { line: 3, marker: "~" as const, tone: "review" as const },
  { line: 5, marker: "~" as const, tone: "review" as const },
  { line: 7, marker: "+" as const, tone: "add" as const },
];

export function ProductPreview() {
  return (
    <section
      aria-label="JSON diff workspace preview"
      className="relative overflow-hidden rounded-[24px] border border-zinc-700 bg-zinc-900 shadow-[0_28px_70px_rgba(0,0,0,0.42)]"
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-800 px-5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="ml-5 font-mono text-xs font-semibold text-zinc-400">
            diff / response.json
          </span>
        </div>
        <span className="font-mono text-xs font-semibold text-emerald-400">
          valid JSON
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5">
        <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-1.5 font-mono text-xs font-semibold">
          {modes.map((tab, index) => (
            <span
              key={tab}
              className={`rounded-xl px-3 py-2 ${
                index === 0
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-500"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300">
          2 changes found
        </div>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <CodePane
          label="Original JSON"
          meta="before"
          code={beforeJson}
          highlights={beforeHighlights}
        />
        <CodePane
          label="Changed JSON"
          meta="after"
          code={afterJson}
          highlights={afterHighlights}
        />
      </div>

      <div className="mx-6 mb-6 flex flex-col gap-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-zinc-700 bg-[#09090B]">
            <JasonMascot mood="success" size={42} label="Jason success state" />
          </div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase text-emerald-400">
              Jason status
            </p>
            <h3 className="mt-1 font-mono text-sm font-semibold text-zinc-50">
              Patch-ready diff generated.
            </h3>
          </div>
        </div>
        <div className="min-w-0 sm:max-w-[230px]">
          <h3 className="font-mono text-sm font-semibold text-zinc-50">
            Review summary
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Three fields changed and one timeout setting was added.
          </p>
        </div>
      </div>
    </section>
  );
}
