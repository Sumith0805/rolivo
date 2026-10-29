import { createContext, useContext, useEffect, useRef } from "react";

// Draws a resume from a template spec. The server builds the Word and PDF files from the same spec.

const LABELS = {
  summary: "Summary",
  profiles: "Profiles",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};
const KEYS = Object.keys(LABELS);

// When `edit` is passed to ResumePreview, every piece of text becomes editable in place.
const EditCtx = createContext(null);

function Ed({ v, p, ph }) {
  const ed = useContext(EditCtx);
  if (!ed) return v;
  return (
    <span
      className="ed"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-ph={ph}
      onBlur={(e) => {
        const t = e.currentTarget.textContent.replace(/\s+/g, " ").trim();
        if (t !== String(v || "").trim()) ed.set(p, t);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {v}
    </span>
  );
}
const str = (x) => (typeof x === "string" ? x.trim() : "");
const list = (x) => (Array.isArray(x) ? x : []);

function safeHref(value) {
  const t = String(value || "").trim();
  if (!t || /\s/.test(t)) return "";
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return /^https?:\/\/[^/]+\.[^/]+/i.test(url) ? url : "";
}
const shown = (u) => String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

const SITES = [
  ["github", "GitHub"], ["linkedin", "LinkedIn"], ["leetcode", "LeetCode"], ["kaggle", "Kaggle"], ["behance", "Behance"],
  ["dribbble", "Dribbble"], ["medium", "Medium"], ["twitter", "Twitter"], ["x.com", "X"], ["hackerrank", "HackerRank"],
  ["codeforces", "Codeforces"],
];
const entryLabel = (u) => (/github\./i.test(String(u)) ? "GitHub" : "Live demo");
function siteLabel(url) {
  const host = shown(url).split("/")[0].toLowerCase();
  const hit = SITES.find(([k]) => host.includes(k));
  return hit ? hit[1] : host || "Website";
}

// marks the spots where the person still needs to add a real number
function Marked({ text }) {
  return String(text)
    .split(/(\[add a number\])/gi)
    .map((part, i) => (/^\[add a number\]$/i.test(part) ? <mark key={i}>{part}</mark> : <span key={i}><Rich text={part} /></span>));
}

// a web address typed inside a sentence becomes a real link
const URL_IN_TEXT = /((?:https?:\/\/|www\.)[^\s)]+)/gi;
function Rich({ text }) {
  const parts = String(text || "").split(URL_IN_TEXT);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const clean = part.replace(/[.,;:]+$/, "");
    const tail = part.slice(clean.length);
    const href = safeHref(clean);
    return href ? (
      <span key={i}>
        <A href={href}>{siteLabel(clean)}</A>
        {tail}
      </span>
    ) : (
      part
    );
  });
}

function A({ href, children }) {
  const ed = useContext(EditCtx);
  if (ed) return children;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    children
  );
}

function Bullets({ items, base }) {
  const ed = useContext(EditCtx);
  const all = list(items).map((b, j) => ({ b: String(b ?? ""), j }));
  const rows = ed ? all : all.filter((x) => x.b.trim());
  if (rows.length === 0 && !ed) return null;
  return (
    <ul>
      {rows.map(({ b, j }) => (
        <li key={j}>
          {ed ? (
            <>
              <Ed v={b} p={[...base, "bullets", j]} ph="Describe what you did" />
              <button type="button" className="ed-x" contentEditable={false} title="Remove this bullet" aria-label="Remove this bullet" onClick={() => ed.removeBullet(base, j)}>
                ×
              </button>
            </>
          ) : (
            <Marked text={b} />
          )}
        </li>
      ))}
      {ed && (
        <li className="ed-add-li">
          <button type="button" className="ed-add" onClick={() => ed.addBullet(base)}>
            + Add a bullet
          </button>
        </li>
      )}
    </ul>
  );
}

function ContactLine({ contact = {}, spec }) {
  const ed = useContext(EditCtx);
  const parts = [];
  if (ed) {
    parts.push(<Ed key="e" v={str(contact.email)} p={["contact", "email"]} ph="email" />);
    parts.push(<Ed key="p" v={str(contact.phone)} p={["contact", "phone"]} ph="phone" />);
    parts.push(<Ed key="l" v={str(contact.location)} p={["contact", "location"]} ph="city" />);
  } else {
    if (str(contact.email)) {
      parts.push(
        <a key="e" href={`mailto:${str(contact.email)}`}>
          {str(contact.email)}
        </a>,
      );
    }
    if (str(contact.phone)) parts.push(<span key="p">{str(contact.phone)}</span>);
    if (str(contact.location)) parts.push(<span key="l">{str(contact.location)}</span>);
  }
  if (spec.links_in_header !== false) {
    list(contact.links).forEach((l, i) => {
      const href = safeHref(l);
      if (ed) parts.push(<Ed key={`k${i}`} v={String(l)} p={["contact", "links", i]} ph="link" />);
      else parts.push(href ? <A key={`k${i}`} href={href}>{siteLabel(l)}</A> : <span key={`k${i}`}>{String(l)}</span>);
    });
  }
  if (parts.length === 0) return null;
  const sep = spec.sep === " " ? "  " : ` ${spec.sep || "·"} `;
  return (
    <p className="rp-contact">
      {parts.map((x, i) => (
        <span key={i}>
          {i > 0 && <i className="rp-sep">{sep}</i>}
          {x}
        </span>
      ))}
    </p>
  );
}

// One job or project. `kind` is "experience" or "projects", `i` its position in the resume.
function Entry({ kind, i, e, spec }) {
  const ed = useContext(EditCtx);
  const isProj = kind === "projects";
  const title = str(isProj ? e.name : e.title);
  const org = isProj ? "" : str(e.company);
  const tech = isProj ? str(e.tech) : "";
  const dates = str(e.dates);
  const href = safeHref(e.link);
  const base = [kind, i];
  const titleP = [...base, isProj ? "name" : "title"];
  const orgP = [...base, "company"];
  const techP = [...base, "tech"];
  const datesP = [...base, "dates"];
  const stacked = spec.entry === "stacked";
  const leadIsOrg = stacked && org;
  const lead = leadIsOrg ? org : title;
  const leadP = leadIsOrg ? orgP : titleP;
  const second = stacked ? (org ? title : tech) : "";
  const secondP = org ? titleP : techP;
  const rest = stacked ? "" : org;

  if (ed) {
    return (
      <div className="rp-entry">
        <p className="rp-line">
          <span>
            <b>
              <Ed v={isProj ? title : title} p={titleP} ph={isProj ? "Project name" : "Job title"} />
            </b>
            {!isProj && (
              <>
                {", "}
                <Ed v={org} p={orgP} ph="Company" />
              </>
            )}
            {isProj && (
              <em>
                {" | "}
                <Ed v={tech} p={techP} ph="Tools used" />
              </em>
            )}
          </span>
          <span className="rp-dates">
            <Ed v={dates} p={datesP} ph="Dates" />
          </span>
        </p>
        <p className="rp-sub">
          <Ed v={String(e.link || "")} p={[...base, "link"]} ph="Link (optional)" />
          <button type="button" className="ed-x" contentEditable={false} title="Remove this whole entry" aria-label="Remove this entry" onClick={() => ed.removeEntry(kind, i)}>
            × remove entry
          </button>
        </p>
        <Bullets items={e.bullets} base={base} />
      </div>
    );
  }
  return (
    <div className="rp-entry">
      <p className="rp-line">
        <span>
          <b>{href && !second ? <A href={href}>{lead}</A> : lead}</b>
          {rest ? `${lead ? ", " : ""}${rest}` : ""}
          {tech && !stacked ? <em> | {tech}</em> : null}
        </span>
        {dates ? <span className="rp-dates">{dates}</span> : null}
      </p>
      {second ? (
        <p className="rp-sub">
          {tech && !org ? <em>{second}</em> : second}
          {href ? (
            <>
              {"  "}
              <A href={href}>{entryLabel(e.link)}</A>
            </>
          ) : null}
        </p>
      ) : href && !second ? null : null}
      <Bullets items={e.bullets} base={base} />
    </div>
  );
}

function Education({ i, e, spec }) {
  const ed = useContext(EditCtx);
  const degree = str(e.degree);
  const school = str(e.school);
  const dates = str(e.dates);
  let details = str(e.details);
  const P = (k) => ["education", i, k];
  if (ed) {
    return (
      <div className="rp-entry">
        <p className="rp-line">
          <span>
            <b>
              <Ed v={degree} p={P("degree")} ph="Degree" />
            </b>
            {", "}
            <Ed v={school} p={P("school")} ph="School or college" />
          </span>
          <span className="rp-dates">
            <Ed v={dates} p={P("dates")} ph="Years" />
          </span>
        </p>
        <p className="rp-detail">
          <Ed v={details} p={P("details")} ph="Details (optional)" />
          <button type="button" className="ed-x" contentEditable={false} aria-label="Remove this entry" onClick={() => ed.removeEntry("education", i)}>
            × remove entry
          </button>
        </p>
      </div>
    );
  }
  if (spec.edu === "table") {
    let right = "";
    if (details && details.length <= 22) {
      right = details;
      details = "";
    }
    return (
      <div className="rp-entry">
        <p className="rp-edu-row">
          <span className="rp-edu-date">{dates}</span>
          <span>
            {degree}
            {school ? (
              <>
                {degree ? " at " : ""}
                <b>{school}</b>
              </>
            ) : null}
          </span>
          <span className="rp-edu-right">{right}</span>
        </p>
        {details ? <p className="rp-detail rp-edu-detail">{details}</p> : null}
      </div>
    );
  }
  if (spec.entry === "stacked") {
    return (
      <div className="rp-entry">
        <p className="rp-line">
          <b>{school || degree}</b>
          {dates ? <span className="rp-dates">{dates}</span> : null}
        </p>
        {school && degree ? <p className="rp-sub">{degree}</p> : null}
        {details ? <p className="rp-detail">{details}</p> : null}
      </div>
    );
  }
  return (
    <div className="rp-entry">
      <p className="rp-line">
        <span>
          <b>{degree}</b>
          {school ? `${degree ? ", " : ""}${school}` : ""}
        </span>
        {dates ? <span className="rp-dates">{dates}</span> : null}
      </p>
      {details ? <p className="rp-detail">{details}</p> : null}
    </div>
  );
}

function AddEntry({ kind, label }) {
  const ed = useContext(EditCtx);
  if (!ed) return null;
  return (
    <button type="button" className="ed-add" onClick={() => ed.addEntry(kind)}>
      + {label}
    </button>
  );
}

function body(resume, key, spec, ed) {
  if (key === "summary") {
    if (ed) return <p><Ed v={str(resume.summary)} p={["summary"]} ph="Write 2 or 3 sentences about yourself" /></p>;
    return str(resume.summary) ? (
      <p>
        <Marked text={str(resume.summary)} />
      </p>
    ) : null;
  }
  if (key === "profiles") {
    if (spec.links_in_header !== false) return null;
    const rows = list((resume.contact || {}).links).map((l, i) => ({ l, i })).filter((x) => str(x.l));
    if (!rows.length) return null;
    return rows.map(({ l, i }) => (
      <div key={i} className="rp-profile">
        <b>{siteLabel(l)}</b>
        {ed ? <Ed v={String(l)} p={["contact", "links", i]} ph="link" /> : <A href={safeHref(l)}>{shown(l)}</A>}
      </div>
    ));
  }
  if (key === "skills") {
    const groups = list(resume.skills)
      .map((g, gi) =>
        g && typeof g === "object"
          ? { gi, group: str(g.group), items: list(g.items).map((i) => String(i).trim()).filter(Boolean), obj: true }
          : { gi, group: "", items: [String(g ?? "").trim()].filter(Boolean), obj: false },
      )
      .filter((g) => ed || g.items.length);
    if (!groups.length && !ed) return null;
    return (
      <>
        {groups.map((g) =>
          ed ? (
            <p key={g.gi}>
              {g.obj && (
                <b>
                  <Ed v={g.group} p={["skills", g.gi, "group"]} ph="Group" />
                  {": "}
                </b>
              )}
              <Ed v={g.items.join(", ")} p={g.obj ? ["skills", g.gi, "items"] : ["skills", g.gi]} ph="Skills, separated by commas" />
            </p>
          ) : spec.skills === "table" && g.group ? (
            <p key={g.gi} className="rp-skill-row">
              <span className="rp-skill-label">{g.group}</span>
              <span>{g.items.join(", ")}</span>
            </p>
          ) : (
            <p key={g.gi}>
              {g.group ? <b>{g.group}: </b> : null}
              {g.items.join(spec.skills === "pipe" ? "  |  " : ", ")}
            </p>
          ),
        )}
        <AddEntry kind="skills" label="Add a skill group" />
      </>
    );
  }
  if (key === "experience" || key === "projects") {
    const nameKey = key === "projects" ? "name" : "title";
    const rows = list(resume[key])
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e && (ed || str(e[nameKey]) || str(e.company)));
    if (!rows.length && !ed) return null;
    return (
      <>
        {rows.map(({ e, i }) => (
          <Entry key={i} kind={key} i={i} e={e} spec={spec} />
        ))}
        <AddEntry kind={key} label={key === "projects" ? "Add a project" : "Add a job"} />
      </>
    );
  }
  if (key === "education") {
    const rows = list(resume.education)
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e && (ed || str(e.degree) || str(e.school)));
    if (!rows.length && !ed) return null;
    return (
      <>
        {rows.map(({ e, i }) => (
          <Education key={i} i={i} e={e} spec={spec} />
        ))}
        <AddEntry kind="education" label="Add education" />
      </>
    );
  }
  const rows = list(resume[key])
    .map((c, i) => ({ c: typeof c === "string" ? c : c && typeof c === "object" ? str(c.name) : "", i }))
    .filter((x) => ed || x.c.trim());
  if (!rows.length && !ed) return null;
  return (
    <ul>
      {rows.map(({ c, i }) => (
        <li key={i}>
          {ed ? (
            <>
              <Ed v={c} p={[key, i]} ph="Add an item" />
              <button type="button" className="ed-x" contentEditable={false} aria-label="Remove this item" onClick={() => ed.removeItem(key, i)}>
                ×
              </button>
            </>
          ) : (
            c
          )}
        </li>
      ))}
      {ed && (
        <li className="ed-add-li">
          <button type="button" className="ed-add" onClick={() => ed.addItem(key)}>
            + Add an item
          </button>
        </li>
      )}
    </ul>
  );
}

function headingLabel(spec, key) {
  const label = (spec.headings && spec.headings[key]) || LABELS[key];
  return spec.caps && !spec.smallcaps ? label.toUpperCase() : label;
}

export default function ResumePreview({ resume, spec, mini = false, edit = null }) {
  const wrap = useRef(null);
  // small copies are only pictures: their links must not take focus or clicks
  useEffect(() => {
    if (wrap.current) wrap.current.inert = mini;
  }, [mini]);
  const order = [...list(spec.order).filter((k) => KEYS.includes(k)), ...KEYS.filter((k) => !list(spec.order).includes(k))];
  const hidden = list(spec.hide);
  const hc = spec.hcolor === "auto" || !spec.hcolor ? (spec.heading === "accent" ? "accent" : "dark") : spec.hcolor;
  const name = spec.name_caps && !edit ? String(resume.name || "").toUpperCase() : resume.name;
  return (
    <EditCtx.Provider value={mini ? null : edit}>
      <div ref={wrap} className={`paper-wrap${mini ? " mini" : ""}${edit && !mini ? " editing" : ""}`}>
        <article
          className="paper rp"
          data-font={spec.font}
          data-header={spec.header}
          data-heading={spec.heading}
          data-halign={spec.heading_align || "left"}
          data-density={spec.density}
          data-caps={spec.caps ? "true" : "false"}
          data-smallcaps={spec.smallcaps ? "true" : "false"}
          data-name={spec.name_style || "bold"}
          data-bullet={spec.bullet === "–" ? "dash" : "dot"}
          style={{
            "--accent": spec.accent,
            "--hc": hc === "accent" ? spec.accent : "#111",
            "--rule": spec.rule || spec.accent,
            "--link": spec.link || spec.accent,
            "--pt": spec.size,
          }}
        >
          <header className="rp-head">
            <h2 style={edit && !mini && spec.name_caps ? { textTransform: "uppercase" } : undefined}>
              {edit && !mini ? <Ed v={String(name || "")} p={["name"]} ph="Your name" /> : name}
            </h2>
            {str(resume.headline) && <p className="rp-headline">{edit && !mini ? <Ed v={str(resume.headline)} p={["headline"]} ph="Headline" /> : str(resume.headline)}</p>}
            <ContactLine contact={resume.contact || {}} spec={spec} />
          </header>
          {order.map((key) => {
            if (hidden.includes(key)) return null;
            const content = body(resume, key, spec, edit && !mini ? edit : null);
            if (!content) return null;
            return (
              <section key={key}>
                <h3>{headingLabel(spec, key)}</h3>
                {content}
              </section>
            );
          })}
        </article>
      </div>
    </EditCtx.Provider>
  );
}
