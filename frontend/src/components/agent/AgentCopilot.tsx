"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { JasonMascot } from "@/components/mascot/JasonMascot";
import { Button } from "@/components/ui/Button";

import {
  agentInstructionLimit,
  type AgentProposal,
  type AgentSelectedTool,
} from "./agent-client";
import {
  useAgentCopilot,
  type AgentDisplayError,
} from "./useAgentCopilot";

type AgentCopilotProps = {
  selectedTool: AgentSelectedTool;
  context: Record<string, string>;
  onApplyProposal: (proposal: AgentProposal) => boolean;
};

const toolDetails: Record<
  AgentSelectedTool,
  {
    label: string;
    intro: string;
    prompts: readonly string[];
    tone: string;
  }
> = {
  formatter: {
    label: "Formatter",
    intro:
      "Ask Jason to format the selected JSON or explain why the Rust parser rejected it.",
    prompts: ["Format and explain this JSON", "Why is this JSON invalid?"],
    tone: "border-sky-400 text-sky-400",
  },
  diff: {
    label: "Diff",
    intro:
      "Ask Jason to compare both documents and summarize the Rust-generated patch operations.",
    prompts: ["What changed between these payloads?", "Summarize the risky changes"],
    tone: "border-emerald-500 text-emerald-400",
  },
  patch: {
    label: "Patch",
    intro:
      "Describe the change. Jason will propose a patch and Rust-validate it before you decide.",
    prompts: ["Remove debug mode", "Set the retry budget"],
    tone: "border-violet-500 text-violet-400",
  },
  pointer: {
    label: "Pointer",
    intro:
      "Describe the value you need. Jason will resolve an exact JSON Pointer without changing the document.",
    prompts: ["Where is the active plan stored?", "Resolve the selected path"],
    tone: "border-amber-400 text-amber-300",
  },
};

export function AgentCopilot({
  selectedTool,
  context,
  onApplyProposal,
}: AgentCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const copilot = useAgentCopilot({ selectedTool, context });
  const details = toolDetails[selectedTool];
  const isQuotaExhausted = copilot.remainingTurns <= 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => composerRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function close() {
    copilot.cancel();
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!instruction.trim()) {
      return;
    }
    const submitted = instruction;
    setInstruction("");
    await copilot.submit(submitted);
  }

  function applyProposal() {
    if (!copilot.proposal || !onApplyProposal(copilot.proposal)) {
      return;
    }
    copilot.markProposalApplied();
    restoreComposerFocus();
  }

  function discardProposal() {
    copilot.discardProposal();
    restoreComposerFocus();
  }

  function restoreComposerFocus() {
    window.requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (composer && !composer.disabled) {
        composer.focus();
      } else {
        dialogRef.current?.focus();
      }
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-500 px-4 font-mono text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        onClick={() => setIsOpen(true)}
      >
        Ask Jason
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:pointer-events-none">
          <button
            type="button"
            aria-label="Close Jason copilot"
            className="absolute inset-0 bg-black/70 lg:hidden"
            onClick={close}
          />
          <aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="jason-copilot-title"
            tabIndex={-1}
            className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-[min(78dvh,628px)] flex-col gap-4 rounded-t-2xl border-t border-zinc-700 bg-zinc-900 p-4 shadow-[0_28px_70px_rgba(0,0,0,0.42)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-dvh lg:w-[424px] lg:gap-6 lg:rounded-none lg:border-l lg:border-t-0 lg:p-6 lg:shadow-[-18px_0_60px_rgba(0,0,0,0.5)]"
            onKeyDown={handleDialogKeyDown}
          >
            <div className="mx-auto h-1 w-12 shrink-0 rounded-full bg-zinc-700 lg:hidden" />

            <header className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <JasonMascot mood={copilot.isSubmitting ? "thinking" : "happy"} size={32} />
                <h2 id="jason-copilot-title" className="text-2xl font-semibold">
                  Jason
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-emerald-400">
                  {copilot.remainingTurns} turns left
                </span>
                <button
                  type="button"
                  aria-label="Close Jason copilot"
                  className="hidden size-8 items-center justify-center rounded-lg text-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 lg:inline-flex"
                  onClick={close}
                >
                  ×
                </button>
              </div>
            </header>

            <div className="flex shrink-0 items-center gap-3 rounded-lg bg-zinc-800 p-3 font-mono text-xs text-zinc-400">
              <span className={`rounded-lg border px-3 py-2 font-semibold ${details.tone}`}>
                {details.label}
              </span>
              <span>{formatContextSize(copilot.contextBytes)} context</span>
            </div>

            <div
              aria-live="polite"
              className="jason-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
            >
              <section className="rounded-lg border border-zinc-800 bg-zinc-800 p-3">
                <p className="font-mono text-xs font-semibold text-emerald-400">
                  JASON · {details.label.toUpperCase()} ASSISTANT
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{details.intro}</p>
              </section>

              {copilot.messages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {details.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-lg px-3 py-2 text-left font-mono text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
                      onClick={() => {
                        setInstruction(prompt);
                        composerRef.current?.focus();
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {copilot.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-10 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-zinc-50"
                      : "mr-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 text-zinc-300"
                  }
                >
                  {message.content}
                </div>
              ))}

              {copilot.trace.length > 0 ? (
                <div className="flex flex-col gap-2" aria-label="Agent tool trace">
                  {copilot.trace.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[8px_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-5"
                    >
                      <span
                        className={`size-2 rounded-full ${
                          item.tone === "success" ? "bg-emerald-400" : "bg-sky-400"
                        }`}
                      />
                      <span
                        className={
                          item.tone === "success" ? "text-emerald-400" : "text-sky-400"
                        }
                      >
                        {item.label}
                      </span>
                      <span className="min-w-0 break-words text-zinc-400">
                        {item.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {copilot.error ? <AgentErrorCard error={copilot.error} /> : null}

              {copilot.proposal ? (
                <ProposalCard
                  proposal={copilot.proposal}
                  isSubmitting={copilot.isSubmitting}
                  onApply={applyProposal}
                  onDiscard={discardProposal}
                />
              ) : null}
            </div>

            <form
              className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-3"
              onSubmit={handleSubmit}
            >
              <label htmlFor="jason-instruction" className="sr-only">
                Ask Jason about the selected JSON
              </label>
              <textarea
                ref={composerRef}
                id="jason-instruction"
                rows={2}
                maxLength={agentInstructionLimit}
                disabled={copilot.isSubmitting || isQuotaExhausted}
                value={instruction}
                placeholder={
                  isQuotaExhausted
                    ? "AI turns are exhausted for this session."
                    : "Ask for a change or explanation…"
                }
                className="jason-scrollbar max-h-28 w-full resize-none bg-transparent text-sm leading-6 text-zinc-50 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                onChange={(event) => setInstruction(event.target.value)}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-zinc-400">
                  {instruction.length} / {agentInstructionLimit} · turn {4 - copilot.remainingTurns} of 3
                </span>
                <Button
                  type="submit"
                  disabled={
                    !instruction.trim() || copilot.isSubmitting || isQuotaExhausted
                  }
                  className="h-10 rounded-lg px-4 text-xs"
                >
                  {copilot.isSubmitting ? "Working…" : "Send"}
                </Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Nothing changes until you choose Apply to workspace.
              </p>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({
  proposal,
  isSubmitting,
  onApply,
  onDiscard,
}: {
  proposal: AgentProposal;
  isSubmitting: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const operationCount = proposalOperationCount(proposal);
  const canApply = hasValidWorkspaceResult(proposal);

  return (
    <section className="rounded-xl border border-emerald-500 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xl font-semibold">Proposal ready</h3>
        <span className="font-mono text-xs font-semibold text-emerald-400">
          {operationCount
            ? `${operationCount} ${operationCount === 1 ? "op" : "ops"} · `
            : ""}
          Rust valid
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        The deterministic result is ready for the {proposalLabel(proposal)} workspace.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          className="order-2 h-11 rounded-lg px-4 text-xs sm:order-1"
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button
          type="button"
          disabled={isSubmitting || !canApply}
          className="order-1 h-11 rounded-lg px-4 text-xs sm:order-2"
          onClick={onApply}
        >
          Apply to workspace
        </Button>
      </div>
    </section>
  );
}

function AgentErrorCard({ error }: { error: AgentDisplayError }) {
  const state = errorState(error.code);
  return (
    <section className={`rounded-xl border p-4 ${state.className}`} role="alert">
      <p className="font-mono text-xs font-semibold">{state.label}</p>
      <h3 className="mt-2 text-xl font-semibold text-zinc-50">{state.title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{error.message}</p>
      <p className="mt-3 font-mono text-xs">
        {error.retryable
          ? "Retry if turns remain. Your workspace is unchanged."
          : "The deterministic JSON tools remain available."}
      </p>
    </section>
  );
}

function errorState(code: string) {
  if (code.includes("moderation")) {
    return {
      label: "MODERATION",
      title: "Instruction blocked",
      className: "border-red-500 text-red-400",
    };
  }
  if (code.includes("timeout")) {
    return {
      label: "TIMEOUT",
      title: "60-second limit",
      className: "border-amber-400 text-amber-300",
    };
  }
  if (code.includes("quota") || code.includes("turn_limit")) {
    return {
      label: "QUOTA",
      title: "AI turns exhausted",
      className: "border-amber-400 text-amber-300",
    };
  }
  if (code.includes("budget")) {
    return {
      label: "BUDGET",
      title: "Pilot paused globally",
      className: "border-red-500 text-red-400",
    };
  }
  return {
    label: "AI UNAVAILABLE",
    title: "Jason could not complete this request",
    className: "border-red-500 text-red-400",
  };
}

function proposalOperationCount(proposal: AgentProposal): number | undefined {
  switch (proposal.tool) {
    case "diff":
      return proposal.data.summary.changes;
    case "patch":
      return proposal.data.summary.operations;
    case "formatter":
    case "pointer":
      return undefined;
  }
}

function proposalLabel(proposal: AgentProposal): string {
  switch (proposal.tool) {
    case "formatter":
      return "Formatted Output";
    case "diff":
      return "Diff";
    case "patch":
      return "Patch";
    case "pointer":
      return "Pointer";
  }
}

function hasValidWorkspaceResult(proposal: AgentProposal): boolean {
  if (proposal.tool === "diff") {
    return true;
  }

  try {
    JSON.parse(proposal.data.output);
    return true;
  } catch {
    return false;
  }
}

function formatContextSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
