const workflowSteps = [
  ["Paste", "Drop in a response or config."],
  ["Compare", "Separate structure from noise."],
  ["Share", "Copy pointer or patch."],
];

export function WorkflowBand() {
  return (
    <section
      id="workflow"
      className="mt-10 grid gap-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 md:grid-cols-[1fr_1.1fr]"
    >
      <div>
        <p className="mb-4 font-mono text-sm text-zinc-500">Workflow</p>
        <h2 className="max-w-xl text-3xl font-bold leading-tight md:text-4xl">
          Paste JSON. Compare changes. Share the exact path.
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {workflowSteps.map(([title, body]) => (
          <div key={title}>
            <h3 className="font-mono text-sm font-semibold text-zinc-50">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
