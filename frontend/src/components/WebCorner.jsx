const RADIALS = 7;
const RINGS = 6;
const SIZE = 600;

function polar(r, i) {
  const a = (i / (RADIALS - 1)) * (Math.PI / 2);
  return [r * Math.cos(a), r * Math.sin(a)];
}

function buildPath() {
  const parts = [];
  for (let i = 0; i < RADIALS; i += 1) {
    const [x, y] = polar(SIZE, i);
    parts.push(`M0 0L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  for (let k = 1; k <= RINGS; k += 1) {
    const r = (SIZE * k) / RINGS;
    for (let i = 0; i < RADIALS - 1; i += 1) {
      const [x1, y1] = polar(r, i);
      const [x2, y2] = polar(r, i + 1);
      // pull the control point slightly inward so each strand sags like a real thread
      const [cx, cy] = polar(r * 0.9, i + 0.5);
      parts.push(
        `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      );
    }
  }
  return parts.join("");
}

const PATH = buildPath();

export default function WebCorner({ className = "" }) {
  return (
    <svg
      className={`web ${className}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATH} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
