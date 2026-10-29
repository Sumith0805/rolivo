// A tiny drawing of a template, made from its spec, so the person can see what they are choosing.
const G = "#c9cad8";

function Lines({ x = 6, y, w = 48, n = 3, gap = 5 }) {
  return Array.from({ length: n }, (_, i) => (
    <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.7 : w} height="2" rx="1" fill={G} />
  ));
}

function Heading({ spec, y }) {
  const a = spec.accent;
  if (spec.heading === "bar") return <rect x="6" y={y} width="48" height="4" rx="1" fill={a} />;
  if (spec.heading === "accent") {
    return (
      <>
        <rect x="6" y={y - 1} width="1.6" height="5" fill={a} />
        <rect x="10" y={y} width="16" height="2.5" rx="1" fill={a} />
      </>
    );
  }
  const cx = spec.heading_align === "center" ? 22 : 6;
  return (
    <>
      <rect x={cx} y={y} width="16" height="2.5" rx="1" fill={spec.hcolor === "dark" ? "#333" : a} />
      {spec.heading === "rule" && <rect x="6" y={y + 4} width="48" height=".8" fill={spec.rule || a} />}
    </>
  );
}

export default function TemplateThumb({ spec }) {
  const a = spec.accent || "#4e50de";
  const band = spec.header === "band";
  const center = spec.header === "center";
  const gap = spec.density === "compact" ? 3.6 : spec.density === "airy" ? 6 : 5;
  const top = band ? 20 : 19;
  return (
    <svg viewBox="0 0 60 80" width="60" height="80" aria-hidden="true" className="tpl-thumb">
      <rect x=".5" y=".5" width="59" height="79" rx="3" fill="#fff" />
      {band ? <rect x=".5" y=".5" width="59" height="15" rx="3" fill={a} /> : null}
      <rect x={center ? 15 : 6} y={band ? 5 : 6} width={center ? 30 : 26} height="4.5" rx="1" fill={band ? "#fff" : a} />
      <rect x={center ? 18 : 6} y={band ? 11 : 12} width={center ? 24 : 34} height="1.8" rx=".9" fill={band ? "#fff" : G} />
      {[0, 1, 2].map((i) => {
        const y = top + 3 + i * (gap * 3 + 5);
        return (
          <g key={i}>
            <Heading spec={spec} y={y} />
            <Lines y={y + 8} n={3} gap={gap} />
          </g>
        );
      })}
    </svg>
  );
}
