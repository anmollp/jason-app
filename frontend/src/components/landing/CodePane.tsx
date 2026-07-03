type CodePaneProps = {
  label: string;
  code: string;
  changed?: boolean;
};

export function CodePane({ label, code, changed = false }: CodePaneProps) {
  return (
    <article className="min-h-[286px] rounded-[18px] border border-zinc-800 bg-[#09090B] p-5">
      <div className="mb-5 font-mono text-xs font-semibold text-zinc-500">
        {label}
      </div>
      <pre
        className={`overflow-hidden rounded-lg font-mono text-sm leading-6 ${
          changed
            ? "bg-[linear-gradient(transparent_48px,rgba(16,185,129,.16)_48px,rgba(16,185,129,.16)_76px,transparent_76px,transparent_94px,rgba(56,189,248,.12)_94px,rgba(56,189,248,.12)_122px,transparent_122px,transparent_190px,rgba(124,58,237,.16)_190px,rgba(124,58,237,.16)_218px,transparent_218px)] text-zinc-50"
            : "text-zinc-400"
        }`}
      >
        <code>{code}</code>
      </pre>
    </article>
  );
}
