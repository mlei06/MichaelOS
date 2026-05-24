/* ============================================================
   Portfolio scroll sections (below terminal)
   ============================================================ */

import React from 'react';
import { getNode } from '../lib/fs.ts';

function Section({ id, anchor, title, meta, children }) {
  return (
    <section className="section" id={id} data-screen-label={id}>
      <div className="section-head">
        <span className="anchor">{anchor}</span>
        <h2>{title}</h2>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function AboutSection({ onRun }) {
  return (
    <Section id="about" anchor="~/about" title="A bit about me" meta="cat about.md">
      <div className="prose">
        <p>
          I'm Michael — I build at the intersection of <strong>product</strong> and <strong>systems</strong>.
          I like problems where the UI hides something deeply technical:
          realtime infra wearing a calm front-end, dev tools that feel like consumer apps,
          search that responds before you finish typing.
        </p>
        <p>
          Currently studying CS at Duke ('26). Previously interned on platform teams where
          I learned that the boring 5% — observability, back-pressure, retry semantics —
          decides whether the other 95% ever ships.
        </p>
        <p>
          <strong>What I'm looking for next:</strong> small teams, short iteration loops,
          infra that user-facing engineers actually touch, people who write things down.
        </p>
        <p>
          Outside work: pour-over coffee, long runs, used bookstores. Sometimes I write
          about engineering — <code onClick={() => onRun("blog")} style={{cursor:"pointer"}}>blog</code>.
        </p>
      </div>
    </Section>
  );
}

function ProjectsSection({ onRun }) {
  const projectsDir = getNode(["home", "michael", "projects"]);
  const projects = Object.entries(projectsDir.children);
  return (
    <Section id="projects" anchor="~/projects" title="Selected projects" meta={`${projects.length} projects · ls -la`}>
      <div className="projects">
        {projects.map(([name, p]) => {
          const m = p.meta;
          return (
            <div className="project" key={name} onClick={() => onRun(`cat projects/${name}/README.md`)}>
              <div className="project-head">
                <span className="project-name">
                  <span className="slash">./</span>{m.name}
                </span>
                <span className="project-year">{m.year}</span>
              </div>
              <p className="project-blurb">{m.blurb}</p>
              <div className="project-tags">
                {m.role && <span className="tag lead">{m.role}</span>}
                {m.tags.map(t => <span key={t} className="tag">{t}</span>)}
                <span className="tag" style={{color: "var(--green)", borderColor: "currentColor", opacity: 0.6}}>{m.status}</span>
              </div>
              <div className="project-cmd">
                <span className="dollar">$</span>
                <span>cat projects/{name}/README.md</span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function NowSection() {
  const items = [
    ["Reading",   <>Designing Data-Intensive Applications <strong>(re-read, ch. 5–9)</strong></>],
    ["Building",  <>A local-first note tool with <strong>CRDT sync</strong></>],
    ["Learning",  <>Rust + tokio, mostly for fun</>],
    ["Listening", <>Acquired podcast backlog</>],
    ["Status",    <><strong>Recruiting</strong> for Summer / New-Grad 2026 SWE roles</>],
    ["Cooking",   <>Trying every dumpling recipe my grandmother sent me</>],
  ];
  return (
    <Section id="now" anchor="~/now" title="What I'm working on right now" meta="updated May 18, 2026">
      <div className="now-list">
        {items.map(([label, text]) => (
          <div className="now-item" key={label}>
            <div className="now-label">{label}</div>
            <div className="now-text">{text}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BlogSection({ onRun }) {
  const blogDir = getNode(["home", "michael", "blog"]);
  const posts = Object.entries(blogDir.children)
    .sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <Section id="blog" anchor="~/blog" title="Writing" meta={`${posts.length} posts · ls blog/`}>
      <div className="blog-list">
        {posts.map(([fn, p]) => (
          <div className="blog-item" key={fn} onClick={() => onRun(`cat blog/${fn}`)}>
            <div className="blog-date">{p.meta.date}</div>
            <div>
              <div className="blog-title">{p.meta.title}</div>
              <div className="blog-desc">{p.meta.desc}</div>
            </div>
            <div className="blog-read">cat →</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ResumeSection({ onRun }) {
  return (
    <Section id="resume" anchor="~/resume.pdf" title="Resume" meta="89.4K · cat resume.pdf">
      <div className="resume-table">
        <div className="resume-block">
          <h3>Education</h3>
          <div className="resume-row">
            <div>
              <div className="resume-title">Duke University — B.S. Computer Science</div>
              <div className="resume-sub">Minor in Statistics · GPA 3.91 · Distributed Systems, Compilers, DB Internals</div>
            </div>
            <div className="resume-when">Aug 2022 – May 2026</div>
          </div>
        </div>

        <div className="resume-block">
          <h3>Experience</h3>
          <div className="resume-row">
            <div>
              <div className="resume-title">SWE Intern · Platform team</div>
              <div className="resume-sub">
                Led migration of homegrown job runner to Temporal across 14 services.
                Cut p95 retry latency by 62%, reduced on-call pages ~40%.
              </div>
            </div>
            <div className="resume-when">Jun – Aug 2025</div>
          </div>
          <div className="resume-row">
            <div>
              <div className="resume-title">SWE Intern · Search team</div>
              <div className="resume-sub">
                Built a typed query DSL on Postgres. Replaced ~3,100 lines of ad-hoc
                SQL across 6 internal admin tools.
              </div>
            </div>
            <div className="resume-when">Jun – Aug 2024</div>
          </div>
          <div className="resume-row">
            <div>
              <div className="resume-title">Co-founder · harbor</div>
              <div className="resume-sub">
                Observability sidecar for student dev teams. 180+ projects, 3 universities,
                runs on a single $40/mo box.
              </div>
            </div>
            <div className="resume-when">2024 – present</div>
          </div>
        </div>

        <div className="resume-block">
          <h3>Skills</h3>
          <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
            <div>
              <div className="resume-sub" style={{marginBottom:6, color:"var(--text-dim)", fontFamily:"var(--mono)", fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase"}}>Languages</div>
              <div className="skills">
                {["TypeScript","Rust","Go","Python","Swift","SQL"].map(s => <span key={s} className="skill">{s}</span>)}
              </div>
            </div>
            <div>
              <div className="resume-sub" style={{marginBottom:6, color:"var(--text-dim)", fontFamily:"var(--mono)", fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase"}}>Systems</div>
              <div className="skills">
                {["Postgres","Kafka","Clickhouse","Kubernetes","OpenTelemetry","Temporal"].map(s => <span key={s} className="skill">{s}</span>)}
              </div>
            </div>
            <div>
              <div className="resume-sub" style={{marginBottom:6, color:"var(--text-dim)", fontFamily:"var(--mono)", fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase"}}>Frontend</div>
              <div className="skills">
                {["React","SolidJS","SwiftUI","Tailwind","Vite"].map(s => <span key={s} className="skill">{s}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div>
          <button className="rec-btn" onClick={() => onRun("resume")} style={{fontSize:13, padding:"10px 16px"}}>
            <span>↓</span>
            <span>Download resume.pdf</span>
          </button>
        </div>
      </div>
    </Section>
  );
}

function ContactSection() {
  const items = [
    { label: "email",    value: "michael.lei@duke.edu",            href: "mailto:michael.lei@duke.edu" },
    { label: "github",   value: "github.com/michaellei",           href: "https://github.com/" },
    { label: "linkedin", value: "linkedin.com/in/michaellei",      href: "https://linkedin.com/" },
    { label: "calendar", value: "cal.com/michaellei/intro",        href: "#" },
  ];
  return (
    <Section id="contact" anchor="~/contact" title="Get in touch" meta="reply within 24h">
      <div className="contact-grid">
        {items.map(it => (
          <a className="contact-card" href={it.href} key={it.label} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noopener">
            <div className="contact-label">{it.label}</div>
            <div className="contact-value">{it.value}</div>
          </a>
        ))}
      </div>
    </Section>
  );
}

function Portfolio({ onRun }) {
  return (
    <>
      <AboutSection onRun={onRun} />
      <ProjectsSection onRun={onRun} />
      <NowSection />
      <BlogSection onRun={onRun} />
      <ResumeSection onRun={onRun} />
      <ContactSection />
    </>
  );
}

export { Portfolio };
export default Portfolio;
