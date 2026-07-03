export function InspectorPanel() {
  return (
    <aside className="flex min-h-[420px] w-full flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-5 lg:w-[170px]">
      <div>
        <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
          Stats
        </p>
        <dl className="mt-5 space-y-3 font-mono text-sm">
          <div>
            <dt className="text-zinc-500">Lines</dt>
            <dd className="mt-1 text-zinc-50">5</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Keys</dt>
            <dd className="mt-1 text-zinc-50">3</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Issues</dt>
            <dd className="mt-1 text-emerald-400">0</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8">
        <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
          Actions
        </p>
        <div className="mt-4 flex flex-wrap gap-3 lg:flex-col">
          <button
            type="button"
            className="h-11 rounded-xl bg-emerald-500 px-5 font-mono text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Copy
          </button>
          <button
            type="button"
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-800 px-5 font-mono text-sm font-semibold text-zinc-50 transition hover:bg-zinc-700"
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
