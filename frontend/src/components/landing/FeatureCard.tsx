type FeatureCardProps = {
  number: string;
  title: string;
  body: string;
  colorClassName: string;
};

export function FeatureCard({
  number,
  title,
  body,
  colorClassName,
}: FeatureCardProps) {
  return (
    <article className="min-h-[206px] rounded-[22px] border border-zinc-800 bg-zinc-900 p-6">
      <div
        className={`grid size-11 place-items-center rounded-[13px] font-mono text-xs font-black text-white ${colorClassName}`}
      >
        {number}
      </div>
      <h3 className="mt-7 font-mono text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
    </article>
  );
}
