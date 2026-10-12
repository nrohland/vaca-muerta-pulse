// Same neutral, stroke-based SVG system as the existing theme control.
export function MeasurementIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 6v5m5-5v3m5-3v5" />
    </svg>
  );
}
