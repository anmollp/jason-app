export function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Built with Rust, Next.js, and NestJS.</span>
      <a
        href="https://github.com/anmollp/jason-app"
        target="_blank"
        rel="noreferrer"
        className="font-mono font-semibold text-zinc-400 hover:text-zinc-50"
      >
        View source
      </a>
    </footer>
  );
}
