/* ============================================================
   App contents (window bodies)
   ============================================================ */

import React, { useState } from 'react';
import { getNode, formatSize } from '../lib/fs.ts';

const PROFILE_PHOTO = '/media/profile/photo.jpg';
const AVATAR_PHOTO = '/media/avatar/photo.jpg';

function ProfilePhoto({ src, alt, className, placeholderClass, placeholder }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={placeholderClass}>{placeholder}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
function AppShell({ breadcrumb, title, meta, children }) {
  return (
    <div className="app-content">
      {breadcrumb && (
        <div className="breadcrumb">
          {breadcrumb.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">›</span>}
              <span className="seg">{seg}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {title && <h1>{title}</h1>}
      {meta && <div className="meta">{meta}</div>}
      {children}
    </div>
  );
}

/* ---------- Projects index ---------- */
function ProjectsApp({ openWindow }) {
  const projectsDir = getNode(["home", "michael", "Desktop", "projects"]);
  const entries = Object.entries(projectsDir.children);
  return (
    <AppShell breadcrumb={["~", "projects"]} title="Projects" meta={`${entries.length} items`}>
      <div className="project-grid">
        {entries.map(([name, p]) => (
          <div
            key={name}
            className="project-card"
            onClick={() => openWindow({ app: "project", arg: name })}
          >
            <div className="project-card-hero">
              {p.meta.hero && p.meta.hero.src
                ? <img src={p.meta.hero.src} alt="" />
                : <span className="project-card-placeholder">$</span>}
            </div>
            <div className="project-card-body">
              <div className="project-card-title">
                {name}<span className="ext">/</span>
              </div>
              <div className="project-card-meta">
                <span className="project-card-year">{p.meta.year}</span>
                {p.meta.status && (
                  <>
                    <span className="project-card-dot">·</span>
                    <span className="project-card-status">{p.meta.status}</span>
                  </>
                )}
              </div>
              {p.meta.blurb && (
                <div className="project-card-blurb">{p.meta.blurb}</div>
              )}
              {p.meta.links && p.meta.links.length > 0 && (
                <div className="finder-link-badges" onClick={(e) => e.stopPropagation()}>
                  {p.meta.links.map((l, i) => {
                    const meta = LINK_META[l.kind] || { glyph: "↗" };
                    return (
                      <a key={i} className={`finder-link-badge kind-${l.kind}`} href={l.url} target="_blank" rel="noopener noreferrer" title={l.label}>
                        <span>{meta.glyph}</span>
                        <span>{l.kind}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/* ---------- Markdown rendering ---------- */

function renderInlineMd(text, keyOffset = 0) {
  // Parse `code`, **bold**, *italic*, _italic_ into React nodes.
  const out = [];
  let buf = "";
  let i = 0;
  let key = keyOffset;
  const flush = () => {
    if (buf) { out.push(buf); buf = ""; }
  };
  while (i < text.length) {
    const ch = text[i];
    // inline code: `...`
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        out.push(<code key={`c${key++}`}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    // bold: **...**
    if (ch === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        flush();
        out.push(<strong key={`b${key++}`}>{renderInlineMd(text.slice(i + 2, end), key * 100)}</strong>);
        i = end + 2;
        continue;
      }
    }
    // italic: *...* or _..._  (single delimiter, must not be ** and must have non-space after open)
    if ((ch === "*" || ch === "_") && text[i + 1] !== ch && text[i + 1] !== " ") {
      // for *, ensure not part of ** sequence right before
      const end = text.indexOf(ch, i + 1);
      if (end !== -1 && end > i + 1 && text[end - 1] !== " ") {
        // basic word-boundary check to avoid underscores in identifiers
        const prev = text[i - 1];
        if (!prev || /[\s\.,;:!?\(\)\[\]\{\}\"\']/.test(prev) || i === 0) {
          flush();
          out.push(<em key={`i${key++}`}>{renderInlineMd(text.slice(i + 1, end), key * 100)}</em>);
          i = end + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function renderMarkdown(content) {
  if (!content) return null;
  const lines = content.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // image: ![alt](src)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      blocks.push({ kind: "img", alt: imgMatch[1], src: imgMatch[2] });
      i++; continue;
    }
    // code fence ```
    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    // heading #..####
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      i++; continue;
    }
    // unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    // ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    // blockquote
    if (line.startsWith("> ")) {
      const lns = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        lns.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: "quote", text: lns.join(" ") });
      continue;
    }
    // horizontal rule
    if (line.match(/^[-─]{3,}\s*$/)) { blocks.push({ kind: "hr" }); i++; continue; }
    // blank line
    if (line.trim() === "") { i++; continue; }
    // paragraph: gather until blank line or special block
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^(#{1,4}\s|```|\s*[-*]\s+|\s*\d+\.\s+|> |[-─]{3,}\s*$)/)
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks.map((b, idx) => {
    switch (b.kind) {
      case "img":
        return (
          <figure key={idx} className="md-image">
            <img src={b.src} alt={b.alt} loading="lazy" />
          </figure>
        );
      case "h":
        if (b.level === 1) return <h2 key={idx} className="md-h1">{renderInlineMd(b.text)}</h2>;
        if (b.level === 2) return <h3 key={idx} className="md-h2">{renderInlineMd(b.text)}</h3>;
        if (b.level === 3) return <h4 key={idx} className="md-h3">{renderInlineMd(b.text)}</h4>;
        return <h5 key={idx} className="md-h4">{renderInlineMd(b.text)}</h5>;
      case "code":
        return <pre key={idx} className="md-code"><code>{b.text}</code></pre>;
      case "ul":
        return <ul key={idx} className="md-ul">{b.items.map((it, j) => <li key={j}>{renderInlineMd(it)}</li>)}</ul>;
      case "ol":
        return <ol key={idx} className="md-ol">{b.items.map((it, j) => <li key={j}>{renderInlineMd(it)}</li>)}</ol>;
      case "quote":
        return <blockquote key={idx} className="md-quote">{renderInlineMd(b.text)}</blockquote>;
      case "hr":
        return <hr key={idx} className="md-hr" />;
      default:
        return <p key={idx} className="md-p">{renderInlineMd(b.text)}</p>;
    }
  });
}

/* ---------- Content renderer (supports {{img:id|caption}} markers) ---------- */
function renderRichContent(content) {
  if (!content) return null;
  const re = /\{\{img:([^|}]+)(?:\|([^}]+))?\}\}/g;
  const out = [];
  let last = 0; let m; let key = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      const text = content.slice(last, m.index);
      if (text.trim()) out.push(
        <div key={key++} className="md-block">{renderMarkdown(text)}</div>
      );
    }
    const id = m[1].trim();
    const caption = (m[2] || `image: ${id}`).trim();
    out.push(
      <figure key={key++} className="inline-image">
        <img src={`/media/${id}`} alt={caption} loading="lazy" />
        <figcaption>{caption}</figcaption>
      </figure>
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const text = content.slice(last);
    if (text.trim()) out.push(
      <div key={key++} className="md-block">{renderMarkdown(text)}</div>
    );
  }
  return out;
}
const LINK_META = {
  github:   { glyph: "<>", label: "github" },
  demo:     { glyph: "↗",  label: "demo" },
  video:    { glyph: "▶",  label: "video" },
  docs:     { glyph: "§",  label: "docs" },
  post:     { glyph: "¶",  label: "writeup" },
  package:  { glyph: "◫",  label: "package" },
  appstore: { glyph: "↓",  label: "app store" },
};

function ProjectLinks({ links }) {
  if (!links || !links.length) return null;
  return (
    <div className="project-links">
      {links.map((l, i) => {
        const meta = LINK_META[l.kind] || { glyph: "↗", label: l.kind };
        return (
          <a
            key={i}
            className={`link-pill kind-${l.kind}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="lp-glyph">{meta.glyph}</span>
            <span className="lp-label">{l.label}</span>
            <span className="lp-arrow">↗</span>
          </a>
        );
      })}
    </div>
  );
}

function ProjectApp({ arg }) {
  const node = getNode(["home", "michael", "Desktop", "projects", arg]);
  if (!node) return <AppShell title="not found">No such project.</AppShell>;
  const m = node.meta;
  const readme = node.children["README.md"];
  return (
    <div className="app-content project-detail">
      <div className="breadcrumb">
        <span className="seg">~</span><span className="sep">›</span>
        <span className="seg">projects</span><span className="sep">›</span>
        <span className="seg">{arg}</span>
      </div>
      <h1><span className="slash">./</span>{m.name}</h1>
      <div className="meta">{m.year} · {m.role}</div>
      <div className="tags">
        <span className="tag lead">{m.role}</span>
        {m.tags.map(t => <span key={t} className="tag">{t}</span>)}
        {m.status && <span className="tag status">{m.status}</span>}
      </div>
      <ProjectLinks links={m.links} />
      <div className="rich-content">{renderRichContent(readme.content)}</div>
    </div>
  );
}

/* ---------- About ---------- */
function AboutApp() {
  const node = getNode(["home", "michael", "Desktop", "about.md"]);
  return (
    <AppShell breadcrumb={["~", "about.md"]} title="About me" meta="Michael Lei · Duke ECE + CS · May 2028">
      <div className="about-layout">
        <div className="about-photo">
          <div className="about-photo-frame">
            <ProfilePhoto
              src={PROFILE_PHOTO}
              alt="Michael Lei"
              className="about-photo-img"
              placeholderClass="about-photo-placeholder"
              placeholder="Add photo.jpg to public/media/profile/"
            />
          </div>
        </div>
        <div className="about-prose">{renderMarkdown(node.content)}</div>
      </div>
    </AppShell>
  );
}

/* ---------- Blog index ---------- */
function deriveBlogMeta(p) {
  const meta = p.meta || {};
  let title = meta.title;
  let desc = meta.desc;
  const body = p.content || "";

  if (!title) {
    const m = body.match(/^#\s+(.+?)\s*$/m);
    if (m) title = m[1].replace(/^Idea\s+\d+:\s*/i, "");
  }
  if (!desc) {
    // Prefer an italic "*Angle: ...*" or "*...*" tagline near the top.
    const angle = body.match(/^\*([^*\n]{8,200})\*\s*$/m);
    if (angle) {
      desc = angle[1].replace(/^Angle:\s*/i, "");
    } else {
      // Otherwise first non-heading paragraph.
      const para = body
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .find(s => s && !s.startsWith("#") && !s.startsWith("*"));
      if (para) desc = para.length > 180 ? para.slice(0, 177) + "…" : para;
    }
  }
  return { title: title || "Untitled", date: meta.date, desc };
}

function BlogApp({ openWindow }) {
  const blogDir = getNode(["home", "michael", "Desktop", "blog"]);
  const posts = Object.entries(blogDir.children)
    .sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <AppShell breadcrumb={["~", "blog"]} title="Writing" meta={`${posts.length} posts`}>
      <div className="blog-grid">
        {posts.map(([fn, p]) => {
          const { title, date, desc } = deriveBlogMeta(p);
          return (
            <div className="blog-card" key={fn} onClick={() => openWindow({ app: "post", arg: fn })}>
              {date && <div className="blog-card-date">{date}</div>}
              <div className="blog-card-title">{title}</div>
              {desc && <div className="blog-card-desc">{desc}</div>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

/* ---------- Blog post ---------- */
function PostApp({ arg }) {
  const node = getNode(["home", "michael", "Desktop", "blog", arg]);
  if (!node) return <AppShell title="not found">No such post.</AppShell>;
  const hero = node.meta && node.meta.hero;
  return (
    <div className="app-content">
      <div className="breadcrumb">
        <span className="seg">~</span><span className="sep">›</span>
        <span className="seg">blog</span><span className="sep">›</span>
        <span className="seg">{arg}</span>
      </div>
      <h1>{node.meta.title}</h1>
      <div className="meta">{node.meta.date}</div>
      {hero && hero.src && (
        <div className="hero-image">
          <img src={hero.src} alt={hero.placeholder || ""} loading="lazy" />
        </div>
      )}
      <div className="prose">
        {node.meta.desc && <p style={{fontSize: 16, color: "var(--text)"}}>{node.meta.desc}</p>}
        <div className="rich-content">{renderRichContent(node.content)}</div>
      </div>
    </div>
  );
}

/* ---------- Contact ---------- */
const CONTACT_ICONS = {
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 6l9 7 9-7" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  ),
};

function ContactApp() {
  const node = getNode(["home", "michael", "Desktop", "contact.md"]);
  const meta = (node && node.meta) || {};
  const items = [
    meta.email && { label: "email", href: `mailto:${meta.email}`, svg: CONTACT_ICONS.email },
    meta.github && { label: "github", href: meta.github, svg: CONTACT_ICONS.github },
    meta.linkedin && { label: "linkedin", href: meta.linkedin, svg: CONTACT_ICONS.linkedin },
  ].filter(Boolean);
  return (
    <AppShell breadcrumb={["~", "contact.md"]} title="Get in touch">
      <div className="contact-icons">
        {items.map(it => (
          <a
            key={it.label}
            className="contact-icon-link"
            href={it.href}
            target={it.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label={it.label}
            title={it.label}
          >
            <span className="contact-icon-glyph">{it.svg}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}

/* ---------- Text file viewer (generic for cat'ing arbitrary md files) ---------- */
function TextApp({ arg }) {
  const parts = arg.split("/").filter(Boolean);
  const node = getNode(["home", "michael", "Desktop", ...parts]);
  if (!node) return <AppShell title="not found">No such file.</AppShell>;
  return (
    <AppShell breadcrumb={["~", ...parts]} title={arg} meta={`${formatSize(node.size || 0)} · modified ${node.modified || ""}`}>
      <pre style={{
        fontFamily: "var(--mono)",
        fontSize: 12.5,
        lineHeight: 1.65,
        color: "var(--text-soft)",
        whiteSpace: "pre-wrap",
        margin: 0,
        background: "var(--bg-elev-2)",
        padding: "16px 18px",
        borderRadius: 6,
        border: "1px solid var(--border-soft)",
      }}>{node.content}</pre>
    </AppShell>
  );
}

const APPS = {
  projects: { title: "Projects — Finder",           icon: "$",  comp: ProjectsApp },
  project:  { title: "Project",                     icon: "$",  comp: ProjectApp },
  about:    { title: "About — about.md",            icon: "●",  comp: AboutApp },
  blog:     { title: "Writing — blog/",             icon: "¶",  comp: BlogApp },
  post:     { title: "Post",                        icon: "¶",  comp: PostApp },
  contact:  { title: "Contact — contact.md",        icon: "✉",  comp: ContactApp },
  text:     { title: "Text file",                   icon: "≡",  comp: TextApp },
};

export { APPS, AppShell, ProfilePhoto, AVATAR_PHOTO };
