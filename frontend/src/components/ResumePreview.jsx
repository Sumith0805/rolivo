// Marks the spots where the person still needs to add a real number.
function Marked({ text }) {
  return String(text)
    .split(/(\[add a number\])/gi)
    .map((part, i) =>
      /^\[add a number\]$/i.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
    );
}

function Bullets({ items = [] }) {
  return (
    <ul>
      {items.map((b, i) => (
        <li key={i}>
          <Marked text={b} />
        </li>
      ))}
    </ul>
  );
}

export default function ResumePreview({ resume, order = [], accent = "#4e50de" }) {
  const contact = resume.contact || {};
  const line = [contact.email, contact.phone, contact.location, ...(contact.links || [])]
    .filter(Boolean)
    .join(" · ");

  const sections = {
    summary: resume.summary && (
      <section key="summary">
        <h3>Summary</h3>
        <p>
          <Marked text={resume.summary} />
        </p>
      </section>
    ),
    skills: resume.skills?.length > 0 && (
      <section key="skills">
        <h3>Skills</h3>
        {resume.skills.map((g, i) => (
          <p key={i}>
            <strong>{g.group}:</strong> {(g.items || []).join(", ")}
          </p>
        ))}
      </section>
    ),
    experience: resume.experience?.length > 0 && (
      <section key="experience">
        <h3>Experience</h3>
        {resume.experience.map((e, i) => (
          <div className="entry" key={i}>
            <p>
              <strong>{e.title}</strong>
              {e.company ? ` | ${e.company}` : ""}
              {e.dates ? ` · ${e.dates}` : ""}
            </p>
            <Bullets items={e.bullets} />
          </div>
        ))}
      </section>
    ),
    projects: resume.projects?.length > 0 && (
      <section key="projects">
        <h3>Projects</h3>
        {resume.projects.map((p, i) => (
          <div className="entry" key={i}>
            <p>
              <strong>{p.name}</strong>
              {p.tech ? ` | ${p.tech}` : ""}
            </p>
            <Bullets items={p.bullets} />
          </div>
        ))}
      </section>
    ),
    education: resume.education?.length > 0 && (
      <section key="education">
        <h3>Education</h3>
        {resume.education.map((e, i) => (
          <p key={i}>
            <strong>{e.degree}</strong>
            {e.school ? `, ${e.school}` : ""}
            {e.dates ? ` · ${e.dates}` : ""}
            {e.details ? ` · ${e.details}` : ""}
          </p>
        ))}
      </section>
    ),
    certifications: resume.certifications?.length > 0 && (
      <section key="certifications">
        <h3>Certifications</h3>
        <ul>
          {resume.certifications.map((c, i) => (
            <li key={i}>{String(c)}</li>
          ))}
        </ul>
      </section>
    ),
  };

  return (
    <article className="paper" style={{ "--accent": accent }}>
      <h2>{resume.name}</h2>
      {resume.headline && <p className="paper-headline">{resume.headline}</p>}
      {line && <p className="paper-contact">{line}</p>}
      {order.map((key) => sections[key] || null)}
    </article>
  );
}
