/* Flat mobile layout — rendered under ~768px. The OS metaphor doesn't fit
   on a phone, so we serve a scrollable single-page version that pulls from
   the same content collections. */

import React, { useState } from 'react';
import { getNode } from '../lib/fs.ts';

const RESUME_PDF = '/resumes/master.pdf';
const PROFILE_PHOTO = '/media/profile/photo.jpg';

function renderInline(text) {
  if (!text) return null;
  const parts = [];
  let i = 0;
  const push = (s, key) => parts.push(<React.Fragment key={key}>{s}</React.Fragment>);
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0; let m; let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index), k++);
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith('`')) parts.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) parts.push(<a key={k++} href={lm[2]} target="_blank" rel="noopener noreferrer">{lm[1]}</a>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) push(text.slice(last), k++);
  return parts;
}

function renderParagraphs(md) {
  if (!md) return null;
  const blocks = md.split(/\n\s*\n/);
  return blocks.map((b, i) => {
    const t = b.trim();
    if (!t) return null;
    if (t.startsWith('### ')) return <h3 key={i}>{renderInline(t.slice(4))}</h3>;
    if (t.startsWith('## ')) return <h2 key={i}>{renderInline(t.slice(3))}</h2>;
    if (t.startsWith('# ')) return <h1 key={i}>{renderInline(t.slice(2))}</h1>;
    if (/^[-*] /.test(t)) {
      return (
        <ul key={i}>
          {t.split('\n').filter(Boolean).map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{renderInline(t)}</p>;
  });
}

function ProjectCard({ id, p }) {
  const m = p.meta;
  const [open, setOpen] = useState(false);
  const readme = p.children['README.md'];
  return (
    <article className={`m-card ${open ? 'open' : ''}`}>
      <header onClick={() => setOpen(o => !o)}>
        <div className="m-card-title">
          <span className="m-card-name">{id}<span className="m-slash">/</span></span>
          <span className="m-card-year">{m.year}</span>
        </div>
        {m.blurb && <p className="m-card-blurb">{m.blurb}</p>}
        <div className="m-card-tags">
          {m.role && <span className="m-tag m-tag-role">{m.role}</span>}
          {(m.tags || []).slice(0, 4).map(t => <span key={t} className="m-tag">{t}</span>)}
          {m.status && <span className="m-tag m-tag-status">{m.status}</span>}
        </div>
        <button type="button" className="m-card-toggle">
          {open ? 'hide details' : 'read more'}
        </button>
      </header>
      {open && (
        <div className="m-card-body">
          {m.hero?.src && <img src={m.hero.src} alt="" loading="lazy" className="m-card-hero" />}
          <div className="m-prose">{renderParagraphs(readme?.content)}</div>
          {m.links?.length > 0 && (
            <div className="m-links">
              {m.links.map((l, i) => (
                <a key={i} className="m-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function PostCard({ id, p }) {
  const [open, setOpen] = useState(false);
  const m = p.meta || {};
  return (
    <article className={`m-card ${open ? 'open' : ''}`}>
      <header onClick={() => setOpen(o => !o)}>
        {m.date && <div className="m-card-date">{m.date}</div>}
        <div className="m-card-title">
          <span className="m-card-name">{m.title || id}</span>
        </div>
        {m.desc && <p className="m-card-blurb">{m.desc}</p>}
        <button type="button" className="m-card-toggle">
          {open ? 'hide post' : 'read post'}
        </button>
      </header>
      {open && (
        <div className="m-card-body">
          <div className="m-prose">{renderParagraphs(p.content)}</div>
        </div>
      )}
    </article>
  );
}

export default function Mobile() {
  const aboutNode = getNode(['home', 'michael', 'Desktop', 'about.md']);
  const contactNode = getNode(['home', 'michael', 'Desktop', 'contact.md']);
  const projectsDir = getNode(['home', 'michael', 'Desktop', 'projects']);
  const blogDir = getNode(['home', 'michael', 'Desktop', 'blog']);
  const contactMeta = contactNode?.meta || {};

  const projects = Object.entries(projectsDir?.children || {});
  const posts = Object.entries(blogDir?.children || {}).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="mobile">
      <header className="m-hero">
        <img className="m-avatar" src={PROFILE_PHOTO} alt="Michael Lei" />
        <h1>Michael Lei</h1>
        <p className="m-role">Software engineer · Duke ECE + CS · May 2028</p>
        <p className="m-tagline">
          Future-ready engineer who likes building AI-augmented software that real
          organizations and the people inside them actually use.
        </p>
        <div className="m-cta">
          <a className="m-cta-primary" href={RESUME_PDF} download="michael-lei-resume.pdf">
            Resume ↓
          </a>
          {contactMeta.email && (
            <a className="m-cta-secondary" href={`mailto:${contactMeta.email}`}>
              Email
            </a>
          )}
        </div>
        <div className="m-hero-links">
          {contactMeta.github && <a href={contactMeta.github}>GitHub</a>}
          {contactMeta.linkedin && <a href={contactMeta.linkedin}>LinkedIn</a>}
        </div>
        <p className="m-desktop-hint">
          On desktop, this site is an interactive terminal + windows portfolio.
        </p>
      </header>

      <section className="m-section">
        <h2>About</h2>
        <div className="m-prose">{renderParagraphs(aboutNode?.content)}</div>
      </section>

      <section className="m-section">
        <h2>Projects <span className="m-count">{projects.length}</span></h2>
        <div className="m-cards">
          {projects.map(([id, p]) => <ProjectCard key={id} id={id} p={p} />)}
        </div>
      </section>

      <section className="m-section">
        <h2>Writing <span className="m-count">{posts.length}</span></h2>
        <div className="m-cards">
          {posts.map(([id, p]) => <PostCard key={id} id={id} p={p} />)}
        </div>
      </section>

      <section className="m-section m-contact">
        <h2>Contact</h2>
        <ul>
          {contactMeta.email && <li><a href={`mailto:${contactMeta.email}`}>{contactMeta.email}</a></li>}
          {contactMeta.github && <li><a href={contactMeta.github}>{contactMeta.github.replace(/^https?:\/\//, '')}</a></li>}
          {contactMeta.linkedin && <li><a href={contactMeta.linkedin}>{contactMeta.linkedin.replace(/^https?:\/\//, '')}</a></li>}
        </ul>
      </section>

      <footer className="m-footer">
        <p>© Michael Lei · 2026</p>
      </footer>
    </div>
  );
}
