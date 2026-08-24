interface ElvaLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: number;
}

/** Lighthouse mark — inherits the current text color. Aspect ratio 44×60. */
export function ElvaMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  const height = Math.round((size * 60) / 44);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 44 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Beacon diamond — the light at the top */}
      <polygon points="22,1 28,7 22,13 16,7" fill="currentColor" />
      {/* Lantern room */}
      <rect x="13" y="13" width="18" height="9" fill="currentColor" />
      {/* Tower body — slight outward taper toward base */}
      <polygon points="13,22 31,22 34,54 10,54" fill="currentColor" />
      {/* Base platform */}
      <rect x="3" y="54" width="38" height="6" fill="currentColor" />
    </svg>
  );
}

export function ElvaLogo({ className, iconOnly = false, size = 24 }: ElvaLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <ElvaMark size={size} />
      {!iconOnly && <span className="font-semibold tracking-tight">Elva</span>}
    </div>
  );
}
