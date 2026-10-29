// Font, size, accent colour, spacing, and which sections show and in what order.
const ORDER_ALL = ["summary", "profiles", "skills", "experience", "projects", "education", "certifications", "achievements"];
const NAMES = {
  summary: "Summary",
  profiles: "Profiles (links)",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};
const SWATCHES = ["#111111", "#1b2a49", "#1f5fa8", "#4e50de", "#1b7f5c", "#7a1f2b", "#334155", "#b45309"];
const LIST_KEYS = ["certifications", "achievements"];

export default function StylePanel({ view, tweaks, onChange, resume, onResume }) {
  const set = (patch) => onChange({ ...tweaks, ...patch });
  const order = [...(view.order || []).filter((k) => ORDER_ALL.includes(k)), ...ORDER_ALL.filter((k) => !(view.order || []).includes(k))];
  const hidden = view.hide || [];

  function move(k, dir) {
    const next = [...order];
    const i = next.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ order: next });
  }
  function toggle(k) {
    set({ hide: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] });
  }
  function rename(k, label) {
    const headings = { ...(tweaks.headings || {}) };
    if (label.trim()) headings[k] = label.slice(0, 30);
    else delete headings[k];
    set({ headings });
  }
  // a section the resume has no text for yet: show it, and make sure there is a first item to type into
  function addSection(k) {
    if (LIST_KEYS.includes(k) && !(resume[k] || []).length) onResume({ ...resume, [k]: [""] });
    if (hidden.includes(k)) toggle(k);
  }
  const empty = (k) => {
    if (k === "profiles") return !((resume.contact || {}).links || []).length;
    if (k === "summary") return !String(resume.summary || "").trim();
    const v = resume[k];
    return !Array.isArray(v) || v.filter((x) => (typeof x === "string" ? x.trim() : x)).length === 0;
  };

  return (
    <div className="panel style-panel">
      <h2 className="panel-title">Style and sections</h2>
      <p className="fill-help">These changes show on the page and in the Word and PDF files.</p>

      <div className="style-grid">
        <label>
          Font
          <select value={view.font} onChange={(e) => set({ font: e.target.value })}>
            <option value="sans">Sans-serif (Arial)</option>
            <option value="serif">Serif (Times New Roman)</option>
          </select>
        </label>
        <label>
          Text size: {view.size} pt
          <input type="range" min="9" max="12" step="0.5" value={view.size} onChange={(e) => set({ size: Number(e.target.value) })} />
        </label>
        <label>
          Spacing
          <select value={view.density} onChange={(e) => set({ density: e.target.value })}>
            <option value="compact">Tight</option>
            <option value="normal">Normal</option>
            <option value="airy">Roomy</option>
          </select>
        </label>
      </div>

      <div className="style-colors" role="group" aria-label="Accent colour">
        <span>Accent colour</span>
        {SWATCHES.map((c) => (
          <button key={c} type="button" className={`swatch${view.accent === c ? " on" : ""}`} style={{ background: c }} aria-label={`Use ${c}`} onClick={() => set({ accent: c })} />
        ))}
        <input type="color" value={view.accent || "#111111"} onChange={(e) => set({ accent: e.target.value })} aria-label="Pick any colour" />
      </div>

      <h3 className="style-sub">Sections</h3>
      <ul className="sec-list">
        {order.map((k, i) => {
          const off = hidden.includes(k);
          const none = empty(k);
          return (
            <li key={k} className={off ? "off" : ""}>
              <label className="sec-show">
                <input type="checkbox" checked={!off} onChange={() => (none && off ? addSection(k) : toggle(k))} aria-label={`Show ${NAMES[k]}`} />
              </label>
              <input
                className="field-input sec-name"
                value={(view.headings && view.headings[k]) || ""}
                placeholder={NAMES[k]}
                onChange={(e) => rename(k, e.target.value)}
                aria-label={`Heading for ${NAMES[k]}`}
              />
              {none && <small>empty</small>}
              {none && LIST_KEYS.includes(k) && (
                <button type="button" className="linklike" onClick={() => addSection(k)}>
                  Add items
                </button>
              )}
              <span className="sec-move">
                <button type="button" className="btn btn-ghost" onClick={() => move(k, -1)} disabled={i === 0} aria-label={`Move ${NAMES[k]} up`}>
                  ↑
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => move(k, 1)} disabled={i === order.length - 1} aria-label={`Move ${NAMES[k]} down`}>
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => onChange({})} disabled={Object.keys(tweaks).length === 0}>
          Reset style
        </button>
      </div>
    </div>
  );
}
