type CartLoaderProps = {
  label?: string;
  compact?: boolean;
  screen?: boolean;
};

export function CartLoader({ label = "Cargando...", compact = false, screen = false }: CartLoaderProps) {
  return (
    <div
      className={`cart-loader${compact ? " is-compact" : ""}${screen ? " is-screen" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="cart-loader-motion" aria-hidden="true">
        <span className="cart-loader-trail" />
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11h7l6 31h31l7-23H16" />
          <path d="M22 28h29M25 35h24" />
          <circle cx="23" cy="50" r="4" fill="var(--background)" />
          <circle cx="46" cy="50" r="4" fill="var(--background)" />
        </svg>
      </div>
      <span className="cart-loader-label">{label}</span>
      <span className="cart-loader-dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}
