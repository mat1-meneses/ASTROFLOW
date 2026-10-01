import UserMenu from "./UserMenu";

export default function AppHeader() {
  return (
    <header className="border-b border-astro-border px-8 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <StarIcon />
        <span className="text-lg font-semibold tracking-wider text-astro-text">
          ASTRO<span className="text-astro-accent">FLOW</span>
        </span>
      </div>
      <UserMenu />
    </header>
  );
}

export function StarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className="text-astro-accent flex-shrink-0"
    >
      <path
        d="M10 1l2.39 6.26L19 10l-6.61 2.74L10 19l-2.39-6.26L1 10l6.61-2.74L10 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}