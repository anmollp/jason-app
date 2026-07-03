const proofItems = [
  ["4 modes", "format, diff, patch, pointer"],
  ["0 setup", "paste JSON and inspect"],
  ["dev first", "keyboard-friendly surfaces"],
];

export function ProofStrip() {
  return (
    <div className="mt-20 grid max-w-[540px] grid-cols-3 rounded-[20px] border border-zinc-800 bg-zinc-900">
      {proofItems.map(([value, label], index) => (
        <div
          key={value}
          className={`p-5 ${index > 0 ? "border-l border-zinc-800" : ""}`}
        >
          <div className="font-mono text-sm font-semibold text-zinc-50">
            {value}
          </div>
          <div className="mt-2 text-xs leading-4 text-zinc-500">{label}</div>
        </div>
      ))}
    </div>
  );
}
