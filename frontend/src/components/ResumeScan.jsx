import useCountUp from "../useCountUp.js";

// A little film: a resume gets read line by line, keywords light up, checks pop, a score lands.
// `fast` plays it quicker (for waiting screens); `score` is the number it lands on.
const LINES = [
  { y: 92, w: 150, h: true },
  { y: 104, w: 132 },
  { y: 116, w: 142 },
  { y: 152, w: 138, h: true },
  { y: 164, w: 118 },
  { y: 176, w: 146 },
  { y: 212, w: 126 },
  { y: 224, w: 144, h: true },
  { y: 236, w: 104 },
];
const HEADS = [78, 138, 198];

export default function ResumeScan({ fast = false, score = null, label = "A resume being scanned and scored" }) {
  const shown = useCountUp(score === null ? 0 : score, fast ? 1200 : 2200);
  const arc = score === null ? 86 : score;
  const t = fast ? 0.55 : 1;
  return (
    <svg className={`scan${fast ? " fast" : ""}`} viewBox="0 0 260 330" role="img" aria-label={label}>
      <defs>
        <linearGradient id="scanBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4e50de" stopOpacity="0" />
          <stop offset="0.8" stopColor="#4e50de" stopOpacity="0.38" />
          <stop offset="1" stopColor="#f32e35" stopOpacity="0.85" />
        </linearGradient>
        <clipPath id="scanPaper">
          <rect x="20" y="12" width="200" height="300" rx="14" />
        </clipPath>
      </defs>
      <g className="scan-card">
        <rect x="20" y="12" width="200" height="300" rx="14" fill="#f6f5fb" />
        <g clipPath="url(#scanPaper)">
          <rect className="ln" style={{ "--d": `${0.1 * t}s` }} x="44" y="34" width="96" height="11" rx="3" fill="#1b1a33" />
          <rect className="ln" style={{ "--d": `${0.2 * t}s` }} x="44" y="52" width="64" height="5" rx="2.5" fill="#9a98b8" />
          {HEADS.map((y, i) => (
            <rect key={y} className="ln" style={{ "--d": `${(0.35 + i * 0.5) * t}s` }} x="44" y={y} width="54" height="6" rx="3" fill="#4e50de" />
          ))}
          {LINES.map((l, i) => (
            <g key={l.y}>
              {l.h && <rect className="hl" style={{ "--d": `${(1.2 + i * 0.28) * t}s` }} x="40" y={l.y - 3} width={l.w * 0.46 + 6} height="11" rx="3" fill="#f32e35" />}
              <rect className="ln" style={{ "--d": `${(0.5 + i * 0.16) * t}s` }} x="44" y={l.y} width={l.w} height="5" rx="2.5" fill="#cfcde3" />
            </g>
          ))}
          <rect className="beam" x="20" y="-40" width="200" height="40" fill="url(#scanBeam)" />
        </g>
        {[84, 144, 204].map((y, i) => (
          <g key={y} className="tick" style={{ "--d": `${(1.5 + i * 0.7) * t}s` }}>
            <circle cx="205" cy={y} r="8" fill="#1fa971" />
            <path d="M201 84l3 3 5-6" transform={`translate(0 ${y - 84})`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
      <g className="scan-badge" style={{ "--d": `${2.4 * t}s` }}>
        <circle cx="196" cy="274" r="38" fill="#0d0c1a" stroke="#1b1a33" strokeWidth="4" />
        <circle className="scan-arc" cx="196" cy="274" r="31" fill="none" stroke="#f32e35" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - arc} transform="rotate(-90 196 274)" />
        {score === null ? (
          <path d="M184 275l8 8 15-17" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <text x="196" y="281" textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" fontFamily="inherit">
            {shown}
          </text>
        )}
      </g>
    </svg>
  );
}
