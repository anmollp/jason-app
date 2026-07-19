import { JasonMascot } from "@/components/mascot/JasonMascot";

type JasonToastProps = {
  detail: string;
  onDismiss: () => void;
  title: string;
  tone?: "idle" | "thinking" | "success" | "error";
};

const toneStyles = {
  idle: {
    border: "border-zinc-700 bg-zinc-900",
    text: "text-zinc-300",
  },
  thinking: {
    border: "border-sky-500/40 bg-sky-500/10",
    text: "text-sky-300",
  },
  success: {
    border: "border-emerald-400/70 bg-emerald-500/20",
    text: "text-emerald-300",
  },
  error: {
    border: "border-red-500/40 bg-red-500/10",
    text: "text-red-400",
  },
};

export function JasonToast({
  detail,
  onDismiss,
  title,
  tone = "success",
}: JasonToastProps) {
  const isError = tone === "error";

  return (
    <aside
      aria-live={isError ? "assertive" : "polite"}
      className={`fixed right-5 top-[5.75rem] z-50 flex w-[min(340px,calc(100vw-2.5rem))] items-center gap-2 rounded-2xl border px-3 py-3 shadow-2xl sm:right-8 lg:right-12 ${toneStyles[tone].border}`}
      role={isError ? "alert" : "status"}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-[#09090B]">
        <JasonMascot
          mood={tone}
          size={32}
          label={isError ? "Jason error state" : "Jason formatter state"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-sm font-semibold leading-5 ${toneStyles[tone].text}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-4 text-zinc-300">
          {detail}
        </p>
      </div>
      <button
        aria-label="Dismiss notification"
        className="grid size-6 shrink-0 place-items-center rounded-md font-mono text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
        onClick={onDismiss}
        type="button"
      >
        x
      </button>
    </aside>
  );
}
