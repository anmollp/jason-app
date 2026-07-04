import { JasonMascot } from "@/components/mascot/JasonMascot";

type JasonStatusProps = {
  detail?: string;
  title?: string;
  tone?: "idle" | "success" | "error";
};

const toneStyles = {
  idle: {
    border: "border-zinc-700 bg-zinc-900",
    text: "text-zinc-300",
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

const defaultCopy = {
  idle: {
    title: "Paste JSON to wake Jason",
    detail: "Formatter output will appear here.",
  },
  success: {
    title: "Jason cleaned your JSON",
    detail: "Output is formatted and ready to copy.",
  },
  error: {
    title: "Jason found a parse error",
    detail: "Fix the highlighted JSON and try again.",
  },
};

export function JasonStatus({
  detail,
  title,
  tone = "success",
}: JasonStatusProps) {
  const isError = tone === "error";
  const copy = defaultCopy[tone];

  return (
    <aside
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${toneStyles[tone].border}`}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-zinc-700 bg-[#09090B]">
        <JasonMascot
          mood={tone}
          size={38}
          label={isError ? "Jason error state" : "Jason formatter state"}
        />
      </div>
      <div className="min-w-0">
        <p className={`font-mono text-sm font-semibold ${toneStyles[tone].text}`}>
          {title ?? copy.title}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {detail ?? copy.detail}
        </p>
      </div>
    </aside>
  );
}
