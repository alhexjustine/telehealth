/**
 * An in-house, abstract SVG illustration for the landing hero: a patient and
 * a doctor "card" joined by a consultation link, with a heartbeat motif.
 * Purely decorative (no stock photos, no external host) — hidden from
 * assistive tech since the hero heading and subcopy already carry the
 * meaning.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hero-card-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="hero-card-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Dot-grid backdrop */}
      <g fill="var(--color-border)">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={40 + col * 26} cy={40 + row * 26} r="1.5" />
          )),
        )}
      </g>

      {/* Doctor card (back) */}
      <rect
        x="150"
        y="40"
        width="270"
        height="170"
        rx="20"
        fill="url(#hero-card-a)"
        stroke="var(--color-border)"
      />
      <circle cx="190" cy="80" r="16" fill="var(--color-primary)" opacity="0.85" />
      <rect x="216" y="70" width="120" height="10" rx="5" fill="var(--color-muted-foreground)" opacity="0.5" />
      <rect x="216" y="88" width="80" height="8" rx="4" fill="var(--color-muted-foreground)" opacity="0.3" />
      <rect x="170" y="120" width="230" height="8" rx="4" fill="var(--color-border)" />
      <rect x="170" y="140" width="180" height="8" rx="4" fill="var(--color-border)" />
      <rect x="170" y="160" width="200" height="8" rx="4" fill="var(--color-border)" />

      {/* Consultation link */}
      <path
        d="M 150 220 C 110 250, 110 280, 150 300"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      {/* Patient card (front) */}
      <rect
        x="60"
        y="190"
        width="230"
        height="150"
        rx="20"
        fill="var(--color-card)"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <circle cx="96" cy="228" r="14" fill="url(#hero-card-b)" />
      <rect x="118" y="220" width="90" height="9" rx="4.5" fill="var(--color-foreground)" opacity="0.75" />
      <rect x="118" y="236" width="60" height="7" rx="3.5" fill="var(--color-muted-foreground)" opacity="0.45" />

      {/* Heartbeat pulse */}
      <polyline
        points="84,290 110,290 122,268 136,308 150,290 270,290"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="84" y="312" width="70" height="8" rx="4" fill="var(--color-border)" />
      <rect x="84" y="326" width="110" height="8" rx="4" fill="var(--color-border)" />

      {/* Booked-slot chip, floating */}
      <g transform="translate(330, 250)">
        <rect width="120" height="52" rx="14" fill="var(--color-primary)" />
        <rect x="16" y="14" width="14" height="14" rx="4" fill="var(--color-primary-foreground)" opacity="0.9" />
        <rect x="38" y="14" width="66" height="8" rx="4" fill="var(--color-primary-foreground)" opacity="0.9" />
        <rect x="38" y="28" width="44" height="7" rx="3.5" fill="var(--color-primary-foreground)" opacity="0.6" />
      </g>
    </svg>
  );
}
