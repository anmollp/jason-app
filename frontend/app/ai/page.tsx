import type { Metadata } from "next";
import Link from "next/link";

import { JasonLogo } from "@/components/mascot/JasonLogo";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "AI Copilot architecture | AskJason",
  description:
    "How AskJason constrains an approval-gated AI copilot around deterministic Rust JSON tools.",
};

const metrics = [
  { value: "4", label: "fixed tools" },
  { value: "3", label: "turns / session" },
  { value: "100%", label: "final routing score" },
  { value: "$0.000918", label: "p95 eval session" },
];

const flow = [
  "Submit context",
  "Moderate instruction",
  "Route",
  "Fixed-schema tool",
  "Rust validate",
  "Safe summary",
  "Apply to workspace",
];

const chapters = [
  {
    label: "01 PRODUCT",
    title: "Contextual Copilot drawer",
    body: "Available from Formatter, Diff, Patch, and Pointer with selected context, prompts, turns, a safe summary, and explicit workspace approval.",
    detail: "Welcome · clarify · trace · summary → Apply",
    tone: "border-sky-400 text-sky-400",
  },
  {
    label: "02 AGENT",
    title: "Provider-neutral orchestration",
    body: "The Responses API sits behind AgentProvider with no runtime model escalation and strict round-trip and tool-loop limits.",
    detail: "≤ 2 round trips · ≤ 2 tools/turn",
    tone: "border-zinc-700 text-zinc-400",
  },
  {
    label: "03 CONTRACTS",
    title: "Four shared tool schemas",
    body: "format_json, diff_json, apply_json_patch, and resolve_json_pointer are schema-validated for web and the private local MCP package.",
    detail: "One contract · two surfaces",
    tone: "border-emerald-500 text-emerald-400",
  },
  {
    label: "04 SECURITY",
    title: "Untrusted by default",
    body: "Prompts and JSON remain data. The agent receives no shell, filesystem, network, URL, database, or dynamic tool access.",
    detail: "Private backend · store:false",
    tone: "border-red-500 text-red-400",
  },
  {
    label: "05 IDENTITY + QUOTA",
    title: "Account-free, signed, bounded",
    body: "A signed HttpOnly visitor identity, rotating IP HMAC, and Firestore transactions enforce every hosted quota.",
    detail: "1 session/24h · 3 turns",
    tone: "border-amber-400 text-amber-300",
  },
  {
    label: "06 EVALS",
    title: "60 routing and adversarial cases",
    body: "The final paid Luna run passed all 60 routing, ambiguity, injection, and abuse cases with schema-valid calls and Jason-valid Patch proposals.",
    detail: "100% route · 100% valid",
    tone: "border-sky-400 text-sky-400",
  },
  {
    label: "07 COST + ROLLOUT",
    title: "$20 combined target",
    body: "Scale-to-zero, an enforced $8 provider hard cap, measured p95 cost, and an approved 10-session daily pilot limit surprise spend.",
    detail: "10/day pilot · no automatic increase",
    tone: "border-amber-400 text-amber-300",
  },
  {
    label: "08 MCP",
    title: "Local stdio parity",
    body: "The private, client-neutral Jason MCP package exposes identical schemas and invokes the local jason binary with fixed arguments and stdin.",
    detail: "Caller model · caller budget",
    tone: "border-emerald-500 text-emerald-400",
  },
];

export default function AiCaseStudyPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50">
      <header className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" aria-label="AskJason home" className="flex items-center gap-3">
          <JasonLogo size={34} />
          <span className="hidden font-mono text-xl font-semibold sm:inline">AskJason</span>
        </Link>
        <div className="flex gap-3">
          <Button href="/" variant="secondary" className="h-10 rounded-lg px-4 text-xs">
            Landing
          </Button>
          <Button href="/playground" className="h-10 rounded-lg px-4 text-xs">
            Workspace
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <section>
          <p className="font-mono text-sm font-semibold text-emerald-400">
            /AI CASE STUDY / SYSTEM DESIGN
          </p>
          <h1 className="mt-4 max-w-5xl text-4xl font-bold leading-tight tracking-[-0.5px] sm:text-5xl sm:tracking-[-1px]">
            Building an approval-gated AI copilot for deterministic JSON tools
          </h1>
          <p className="mt-4 max-w-5xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            A production-minded case study of constrained agents, explicit user
            control, provider-neutral orchestration, measurable evals, private
            infrastructure, and a hard operating budget.
          </p>
        </section>

        <section className="grid gap-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-4xl font-bold">{metric.value}</p>
              <p className="mt-2 font-mono text-xs font-semibold text-zinc-400">
                {metric.label}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-700 bg-zinc-800 p-5 lg:p-6">
          <h2 className="text-2xl font-semibold">Request → proposal trust path</h2>
          <ol className="jason-scrollbar mt-4 grid gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-7">
            {flow.map((step, index) => (
              <li
                key={step}
                className={`min-w-40 rounded-lg border p-3 text-sm leading-6 lg:min-w-0 ${
                  index === flow.length - 1
                    ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <span
                  className={`block font-mono text-xs font-semibold ${
                    index === flow.length - 1
                      ? "text-zinc-950"
                      : "text-emerald-400"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 block">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="architecture-chapters">
          <h2 id="architecture-chapters" className="sr-only">
            Architecture chapters
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {chapters.map((chapter) => (
              <article
                key={chapter.label}
                className={`flex flex-col rounded-xl border bg-zinc-900 p-4 ${chapter.tone}`}
              >
                <p className="font-mono text-xs font-semibold">{chapter.label}</p>
                <h3 className="mt-3 text-xl font-semibold leading-7 text-zinc-50">
                  {chapter.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">
                  {chapter.body}
                </p>
                <p className="mt-4 font-mono text-xs leading-5">{chapter.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-400 bg-zinc-900 p-5 text-amber-300">
          <p className="font-mono text-xs font-semibold">RELEASE STATUS</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
            Evidence stays labeled through release
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            The final Luna evaluation reached 100% routing with a $0.000918 p95
            session estimate. Production smoke now covers Formatter, Diff,
            Patch, and Pointer with explicit workspace approval. Cumulative pilot
            estimated usage is $0.003728. The 10-session daily pilot remains
            active while its seven-day review continues.
          </p>
        </section>
      </main>
    </div>
  );
}
