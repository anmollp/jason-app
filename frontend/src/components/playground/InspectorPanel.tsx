type InspectorPanelProps = {
  canCopy: boolean;
  copyLabel?: string;
  stats: Array<{
    label: string;
    tone?: "default" | "success" | "danger" | "warning";
    value: number | string;
  }>;
  onClear: () => void;
  onCopy: () => void;
};

const statToneStyles = {
  default: "text-zinc-50",
  success: "text-emerald-400",
  danger: "text-red-400",
  warning: "text-amber-400",
};

export function InspectorPanel({
  canCopy,
  copyLabel = "Copy",
  stats,
  onClear,
  onCopy,
}: InspectorPanelProps) {
  return (
    <aside className="flex min-h-[420px] w-full flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-5 lg:w-[170px]">
      <div>
        <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
          Stats
        </p>
        <dl className="mt-5 space-y-3 font-mono text-sm">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-zinc-500">{stat.label}</dt>
              <dd className={`mt-1 ${statToneStyles[stat.tone ?? "default"]}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8">
        <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
          Actions
        </p>
        <div className="mt-4 flex flex-wrap gap-3 lg:flex-col">
          <button
            type="button"
            className="h-11 rounded-xl bg-emerald-500 px-5 font-mono text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canCopy}
            onClick={onCopy}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-800 px-5 font-mono text-sm font-semibold text-zinc-50 transition hover:bg-zinc-700"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
