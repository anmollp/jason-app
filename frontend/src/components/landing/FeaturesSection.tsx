import { FeatureCard } from "./FeatureCard";

const features = [
  {
    number: "01",
    title: "Formatter",
    body: "Clean up pasted payloads without losing structure.",
    colorClassName: "bg-sky-400",
  },
  {
    number: "02",
    title: "Diff",
    body: "Compare snapshots with readable change groups.",
    colorClassName: "bg-emerald-500",
  },
  {
    number: "03",
    title: "Patch",
    body: "Generate patch-ready edits from reviewed changes.",
    colorClassName: "bg-violet-600",
  },
  {
    number: "04",
    title: "Pointer",
    body: "Jump to nested paths and share exact references.",
    colorClassName: "bg-amber-500",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-10">
      <p className="mb-5 font-mono text-sm text-zinc-500">Core workflow</p>
      <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
        Four focused tools, one tidy interface.
      </h2>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
