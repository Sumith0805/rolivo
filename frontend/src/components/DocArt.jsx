// Small floating illustrations for empty states and the upload box.
export default function DocArt({ kind = "stack" }) {
  if (kind === "upload") {
    return (
      <svg className="art art-upload" viewBox="0 0 120 120" aria-hidden="true">
        <g className="art-doc">
          <rect x="34" y="26" width="52" height="68" rx="8" fill="#1b1a33" stroke="#4e50de" strokeWidth="2" />
          <rect x="44" y="40" width="32" height="4" rx="2" fill="#4e50de" />
          <rect x="44" y="50" width="26" height="4" rx="2" fill="#34336a" />
          <rect x="44" y="60" width="30" height="4" rx="2" fill="#34336a" />
        </g>
        <g className="art-arrow">
          <circle cx="86" cy="86" r="16" fill="#f32e35" />
          <path d="M86 94V79m-7 7l7-7 7 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  return (
    <svg className="art art-stack" viewBox="0 0 140 120" aria-hidden="true">
      <rect className="art-p3" x="30" y="30" width="64" height="80" rx="9" fill="#14132a" stroke="#34336a" strokeWidth="2" />
      <rect className="art-p2" x="38" y="22" width="64" height="80" rx="9" fill="#1b1a33" stroke="#4e50de" strokeWidth="2" />
      <g className="art-p1">
        <rect x="46" y="14" width="64" height="80" rx="9" fill="#f6f5fb" />
        <rect x="56" y="28" width="30" height="6" rx="3" fill="#1b1a33" />
        <rect x="56" y="42" width="44" height="4" rx="2" fill="#cfcde3" />
        <rect x="56" y="52" width="38" height="4" rx="2" fill="#cfcde3" />
        <rect x="56" y="62" width="42" height="4" rx="2" fill="#cfcde3" />
        <circle cx="100" cy="86" r="12" fill="#f32e35" />
        <path d="M94 86l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
