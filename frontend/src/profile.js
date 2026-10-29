const KEY = "rolivo_name";

export function getName() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setName(name) {
  try {
    if (name) localStorage.setItem(KEY, name);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage can be blocked; the name just will not be remembered */
  }
}

// "karthikeya.abhinav023@gmail.com" -> "Karthikeya"
export function nameFromEmail(email = "") {
  const first = String(email).split("@")[0].split(/[._\-+]/)[0].replace(/[0-9]+/g, "");
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "there";
}

export function displayName(email) {
  return getName().trim() || nameFromEmail(email);
}

/* ---------- the profile: links, projects, certifications ---------- */

export function normalizeUrl(value = "") {
  const t = String(value).trim();
  if (!t || /\s/.test(t)) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

// "https://www.github.com/asha/" -> "github.com/asha"
export function urlLabel(url = "") {
  return String(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

const sameUrl = (a, b) => urlLabel(a).toLowerCase() === urlLabel(b).toLowerCase();

export function emptyProfile() {
  return {
    full_name: "",
    headline: "",
    phone: "",
    location: "",
    summary: "",
    links: { linkedin: "", github: "", leetcode: "", portfolio: "" },
    other_links: [],
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    achievements: [],
  };
}

// fills any missing piece so the page never meets undefined
export function withDefaults(p) {
  const base = emptyProfile();
  const src = p && typeof p === "object" ? p : {};
  return {
    ...base,
    ...src,
    links: { ...base.links, ...(src.links || {}) },
    other_links: src.other_links || [],
    skills: src.skills || [],
    projects: src.projects || [],
    experience: src.experience || [],
    education: src.education || [],
    certifications: src.certifications || [],
    achievements: src.achievements || [],
  };
}

export function profileFirstName(p) {
  return String(p?.full_name || "").trim().split(/\s+/)[0] || "";
}

// every link worth putting on a resume, in a fixed order
export function profileLinks(p) {
  const l = p?.links || {};
  const out = [];
  [
    ["LinkedIn", l.linkedin],
    ["GitHub", l.github],
    ["LeetCode", l.leetcode],
    ["Portfolio", l.portfolio],
  ].forEach(([label, url]) => url && out.push({ label, url }));
  (p?.other_links || []).forEach((o) => o.url && out.push({ label: o.label || urlLabel(o.url), url: o.url }));
  return out;
}

// how much of the profile is filled, and what would help most
export function completeness(p) {
  const l = p?.links || {};
  const checks = [
    [10, "your name", Boolean(p?.full_name)],
    [10, "a headline", Boolean(p?.headline)],
    [10, "contact details", Boolean(p?.phone || p?.location)],
    [10, "your LinkedIn link", Boolean(l.linkedin)],
    [10, "your GitHub link", Boolean(l.github)],
    [10, "your skills", (p?.skills || []).length > 0],
    [20, "a project", (p?.projects || []).length > 0],
    [10, "your education", (p?.education || []).length > 0],
    [10, "a certification", (p?.certifications || []).length > 0],
  ];
  return {
    percent: checks.reduce((n, [w, , ok]) => n + (ok ? w : 0), 0),
    missing: checks.filter(([, , ok]) => !ok).map(([, label]) => label),
  };
}

export function hasContent(p) {
  return (
    Boolean(p?.full_name) &&
    ((p?.projects || []).length > 0 ||
      (p?.skills || []).length > 0 ||
      (p?.experience || []).length > 0 ||
      (p?.education || []).length > 0)
  );
}

// short text the rewrite may treat as facts the person stated (the API keeps 1,500 characters)
export function profileToFacts(p, limit = 1500) {
  const parts = [];
  const links = profileLinks(p);
  if (links.length) parts.push("Links: " + links.map((x) => `${x.label} ${x.url}`).join("; ") + ".");
  const certs = (p?.certifications || []).map((c) =>
    [c.name, [c.issuer, c.year].filter(Boolean).join(" ")].filter(Boolean).join(" - "),
  );
  if (certs.length) parts.push("Certifications: " + certs.join("; ") + ".");
  const projects = (p?.projects || []).map((x) => [x.name, x.link].filter(Boolean).join(" "));
  if (projects.length) parts.push("Projects (with links): " + projects.join("; ") + ".");
  if ((p?.skills || []).length) parts.push("Skills I have: " + p.skills.join(", ") + ".");
  if ((p?.achievements || []).length) parts.push("Achievements: " + p.achievements.join("; ") + ".");
  let out = "";
  for (const part of parts) {
    if ((out + " " + part).trim().length > limit) break;
    out = (out + " " + part).trim();
  }
  return out;
}

// a plain-text resume built only from what the person wrote in their profile
export function profileToResumeText(p, email = "") {
  const lines = [];
  const add = (...x) => lines.push(...x);
  add(p.full_name || "");
  if (p.headline) add(p.headline);
  add([email, p.phone, p.location, ...profileLinks(p).map((x) => x.url)].filter(Boolean).join(" | "));
  if (p.summary) add("", "SUMMARY", p.summary);
  if ((p.skills || []).length) add("", "SKILLS", p.skills.join(", "));
  if ((p.experience || []).length) {
    add("", "EXPERIENCE");
    p.experience.forEach((e) => {
      add([e.title, e.company].filter(Boolean).join(", ") + (e.dates ? ` (${e.dates})` : ""));
      if (e.details) add(e.details);
    });
  }
  if ((p.projects || []).length) {
    add("", "PROJECTS");
    p.projects.forEach((x) => {
      add([x.name, x.tech, x.link].filter(Boolean).join(" | "));
      if (x.description) add(x.description);
    });
  }
  if ((p.education || []).length) {
    add("", "EDUCATION");
    p.education.forEach((e) => {
      add([e.degree, e.school].filter(Boolean).join(", ") + (e.dates ? ` (${e.dates})` : ""));
      if (e.details) add(e.details);
    });
  }
  if ((p.certifications || []).length) {
    add("", "CERTIFICATIONS");
    p.certifications.forEach((c) => add([c.name, c.issuer, c.year].filter(Boolean).join(", ")));
  }
  if ((p.achievements || []).length) add("", "ACHIEVEMENTS", ...p.achievements.map((a) => `- ${a}`));
  return lines.join("\n").trim();
}

// adds what the person already told us (links, phone, certifications) to a rewritten resume
export function mergeProfile(resume, profile, email = "") {
  if (!resume) return resume;
  const r = JSON.parse(JSON.stringify(resume));
  r.contact = r.contact || {};
  if (!r.name && profile?.full_name) r.name = profile.full_name;
  if (!r.contact.email && email) r.contact.email = email;
  if (!r.contact.phone && profile?.phone) r.contact.phone = profile.phone;
  if (!r.contact.location && profile?.location) r.contact.location = profile.location;

  const links = Array.isArray(r.contact.links) ? [...r.contact.links] : [];
  profileLinks(profile).forEach(({ url }) => {
    if (!links.some((x) => sameUrl(x, url))) links.push(url);
  });
  r.contact.links = links;

  // a project in the resume gets its link when the profile has a project of the same name
  (r.projects || []).forEach((p) => {
    const hit = (profile?.projects || []).find(
      (x) => x.link && String(x.name).trim().toLowerCase() === String(p.name).trim().toLowerCase(),
    );
    if (hit && !p.link) p.link = hit.link;
  });

  if ((!r.certifications || r.certifications.length === 0) && (profile?.certifications || []).length) {
    r.certifications = profile.certifications.map((c) =>
      [c.name, [c.issuer, c.year].filter(Boolean).join(", ")].filter(Boolean).join(" - "),
    );
  }
  return r;
}

/* ---------- filling the profile from a resume ---------- */

const norm = (s) => String(s || "").trim().toLowerCase();

// Adds what the resume says to the profile. Nothing that is already filled in is overwritten.
export function mergeAutofill(current, incoming) {
  const base = withDefaults(current);
  const inc = withDefaults(incoming);
  let added = 0;
  const out = { ...base, links: { ...base.links } };

  ["full_name", "headline", "phone", "location", "summary"].forEach((k) => {
    if (!String(base[k] || "").trim() && String(inc[k] || "").trim()) {
      out[k] = inc[k];
      added += 1;
    }
  });
  Object.keys(out.links).forEach((k) => {
    if (!base.links[k] && inc.links[k]) {
      out.links[k] = inc.links[k];
      added += 1;
    }
  });
  const addList = (key, id) => {
    const seen = new Set(base[key].map((x) => id(x)));
    const extra = [];
    inc[key].forEach((x) => {
      const k = id(x);
      if (k && !seen.has(k)) {
        seen.add(k);
        extra.push(x);
      }
    });
    out[key] = [...base[key], ...extra];
    added += extra.length;
  };
  addList("other_links", (x) => norm(urlLabel(x.url)));
  addList("skills", (x) => norm(x));
  addList("projects", (x) => norm(x.name));
  addList("experience", (x) => norm(`${x.title}|${x.company}`));
  addList("education", (x) => norm(`${x.degree}|${x.school}`));
  addList("certifications", (x) => norm(x.name));
  addList("achievements", (x) => norm(x));
  return { profile: out, added };
}
