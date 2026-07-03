import { JasonMascot } from "@/components/mascot/JasonMascot";

type JasonStatusProps = {
  tone?: "success" | "error";
};

export function JasonStatus({ tone = "success" }: JasonStatusProps) {
  const isError = tone === "error";

  return (
    <aside
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        isError
          ? "border-red-500/40 bg-red-500/10"
          : "border-emerald-500/40 bg-emerald-500/10"
      }`}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-zinc-700 bg-[#09090B]">
        <JasonMascot
          mood={isError ? "error" : "success"}
          size={38}
          label={isError ? "Jason error state" : "Jason success state"}
        />
      </div>
      <div className="min-w-0">
        <p
          className={`font-mono text-sm font-semibold ${
            isError ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {isError ? "Jason found a parse error" : "Jason cleaned your JSON"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {isError
            ? "Expected a quoted property name at line 4."
            : "Output is formatted and ready to copy."}
        </p>
      </div>
    </aside>
  );
}
