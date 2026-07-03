import { JasonLogo } from "../mascot/JasonLogo";
import { Button } from "../ui/Button";

export function Navbar() {
    return (
    <header className="mx-auto flex h-20 w-full max-w-[1220px] items-center justify-between rounded-[20px] border border-zinc-800 bg-[#09090B]/90 px-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur md:px-16">
        <div className="flex items-center gap-3">
            <JasonLogo />
            <span className="font-mono text-xl font-semibold text-zinc-50">Jason</span>
        </div>

        <nav className="hidden items-center gap-8 font-mono text-sm font-semibold text-zinc-400 md:flex">
            <a href="#features" className="hover:text-zinc-50">Features</a>
            <a href="#workflow" className="hover:text-zinc-50">Workflow</a>
            <a href="#docs" className="hover:text-zinc-50">Docs</a>
            <a href="https://github.com/anmollp/jason" className="hover:text-zinc-50">GitHub</a>
            <Button href="/playground">Try Jason</Button>
        </nav>
    </header>
    );
}
