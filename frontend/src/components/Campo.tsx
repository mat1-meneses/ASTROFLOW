import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { etiqueta: string };

export default function Campo({ etiqueta, id, ...props }: Props) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-astro-text">{etiqueta}</span>
      <input
        id={id}
        {...props}
        className="mt-1.5 w-full rounded border border-astro-border bg-astro-surface-2 px-3 py-2 text-sm text-astro-text outline-none transition-colors placeholder:text-astro-muted focus:border-astro-accent"
      />
    </label>
  );
}
