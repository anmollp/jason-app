import { Button } from "@/components/ui/Button";

export function AiCopilotSection() {
  return (
    <section id="ai" className="py-20 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-sm font-semibold text-emerald-400">
            AI COPILOT / LIMITED PILOT
          </p>
          <h2 className="mt-6 max-w-xl text-4xl font-bold leading-tight tracking-[-0.5px] sm:text-5xl sm:tracking-[-1px]">
            Ask for the change. Keep control of the JSON.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            Ask Jason routes your request to Formatter, Diff, Patch, or Pointer
            and exposes every fixed-schema tool call. Rust validates each result.
            Nothing edits the workspace until you choose Apply.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/playground">Try Ask Jason</Button>
            <Button href="/ai" variant="secondary">
              View AI architecture
            </Button>
          </div>
          <p className="mt-5 font-mono text-xs leading-6 text-zinc-400 sm:text-sm">
            Anonymous · 1 guided session / rolling 24h · 3 turns · 16 KB context
          </p>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-[0_28px_70px_rgba(0,0,0,0.42)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-2xl font-semibold">Ask Jason</h3>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-emerald-400">
              2 turns left
            </span>
          </div>
          <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-100">
            “Set retries to 5 and remove debug.”
          </p>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <ProofRow label="tool_call" detail="apply_json_patch · 2 operations" />
            <ProofRow
              label="tool_result"
              detail="Rust validation passed · proposal only"
            />
          </div>
          <div className="mt-3 rounded-xl border border-emerald-500 p-4">
            <p className="font-mono text-xs font-semibold text-emerald-400">
              PROPOSAL
            </p>
            <h4 className="mt-2 text-xl font-semibold">Two safe operations</h4>
            <p className="mt-3 whitespace-pre-line font-mono text-xs leading-6 text-zinc-400">
              {"replace /retries → 5\nremove /debug"}
            </p>
            <p className="mt-3 font-mono text-xs text-emerald-400">
              Apply / Discard
            </p>
          </div>
        </div>
      </div>

      <div className="mt-16 grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <TrustItem title="3 turns / 24h" detail="Anonymous guided session" />
        <TrustItem title="4 fixed tools" detail="No shell, network, or URLs" />
        <TrustItem title="Rust authoritative" detail="Proposal before apply" />
        <TrustItem title="$20 monthly target" detail="Planned $8 provider hard cap" />
      </div>
    </section>
  );
}

function ProofRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="grid grid-cols-[8px_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-zinc-800 p-3">
      <span className="size-2 rounded-full bg-emerald-400" />
      <span className="text-emerald-400">{label}</span>
      <span className="min-w-0 text-zinc-400">{detail}</span>
    </div>
  );
}

function TrustItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <p className="text-xl font-semibold">{title}</p>
      <p className="mt-2 text-sm text-zinc-400">{detail}</p>
    </div>
  );
}
