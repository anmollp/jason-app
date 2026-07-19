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
    border: "border-emerald-500/40 bg-emerald-500/10",
    text: "text-emerald-400",
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
      className={`fixed right-5 top-20 z-50 flex w-[min(310px,calc(100vw-2.5rem))] items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl sm:right-8 lg:right-12 ${toneStyles[tone].border}`}
      role={isError ? "alert" : "status"}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-zinc-700 bg-[#09090B]">
        <JasonMascot
          mood={tone}
          size={38}
          label={isError ? "Jason error state" : "Jason formatter state"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-sm font-semibold ${toneStyles[tone].text}`}>
          {title}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {detail}
        </p>
      </div>
      <button
        aria-label="Dismiss notification"
        className="grid size-7 shrink-0 place-items-center rounded-md font-mono text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
        onClick={onDismiss}
        type="button"
      >
        x
      </button>
    </aside>
  );
}
