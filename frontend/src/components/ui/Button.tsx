import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  children,
  href,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
    secondary: "border border-zinc-700 bg-zinc-900 text-zinc-50 hover:bg-zinc-800",
    ghost: "border border-zinc-800 bg-[#09090B] text-zinc-300 hover:border-zinc-700 hover:text-zinc-50",
  };

  const buttonClassName = `inline-flex h-12 items-center justify-center rounded-xl px-6 font-mono text-sm font-semibold transition ${styles[variant]} ${className}`;

  if (href) {
    return (
      <a className={buttonClassName} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button
      className={buttonClassName}
      {...props}
    >
      {children}
    </button>
  );
}
