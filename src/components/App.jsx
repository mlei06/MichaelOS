/* ============================================================
   Desktop + window manager
   ============================================================ */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APPS, ProfilePhoto, AVATAR_PHOTO } from './Apps.jsx';
import { Terminal } from './Terminal.jsx';
import { Window } from './Window.jsx';
import { setFS } from '../lib/fs.ts';
import Mobile from './Mobile.jsx';

const MOBILE_BREAKPOINT = 768;

const MENUBAR_H = 68;
const DOCK_H = 108;

const DOCK_ITEMS = [
  { id: "terminal", iconKey: "terminal", label: "Terminal" },
  { id: "projects", iconKey: "folder",   label: "Projects" },
  { id: "blog",     iconKey: "pen",      label: "Writing" },
  { id: "resume",   iconKey: "fileText", label: "Resume" },
  { id: "about",    iconKey: "user",     label: "About" },
  { id: "contact",  iconKey: "mail",     label: "Contact" },
];

// Inline Lucide-style icons (ISC). Single-color, scale via currentColor.
const DOCK_ICONS = {
  terminal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  fileText: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  ),
};

// Apps I "actually use" — non-functional, atmosphere only.
// Brand icons via simple-icons CDN; glyph kept as load-failure fallback.
const REAL_APPS = [
  { id: "chrome",   label: "Chrome",          iconSlug: "googlechrome",     colorFile: "chrome.svg",            glyph: "C",   bg: "linear-gradient(135deg, oklch(0.7 0.18 25) 0%, oklch(0.78 0.15 90) 50%, oklch(0.7 0.16 145) 100%)", quip: "47 tabs · all important" },
  { id: "docker",   label: "Docker Desktop",  iconSlug: "docker",           colorFile: "docker.svg",            glyph: "≋",   bg: "oklch(0.6 0.13 230)",                                                                              quip: "wondered why my mac was running out of storage — turns out 170GB of it was old docker containers. didn't know you had to prune." },
  { id: "cursor",   label: "Cursor",          iconSlug: "cursor",           glyph: ">_",  bg: "#0a0a0a",                                                                                          quip: "where the real work happens" },
  { id: "vscode",   label: "VS Code",         iconSlug: "visualstudiocode", colorFile: "visualstudiocode.svg", glyph: "</>", bg: "oklch(0.55 0.12 240)",                                                                             quip: "don't use it anymore but can't bring myself to delete it" },
  { id: "valorant", label: "Valorant",        iconSlug: "valorant",         glyph: "V",   bg: "oklch(0.55 0.18 15)",                                                                              quip: (<>peak immortal 1 · <a href="https://tracker.gg/valorant/profile/riot/Myko%23noot/overview?platform=pc&playlist=competitive&season=ce2783e8-44fc-dd48-3da3-33b5ba6c4a22" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>public stats</a></>) },
  { id: "notion",   label: "Notion",          iconSlug: "notion",           colorFile: "notion.svg",            glyph: "N",   bg: "#1f1f1f",                                                                                          quip: "graveyard of half-finished docs" },
  { id: "github",   label: "GitHub Desktop",  iconSlug: "github",           colorFile: "github.svg",            glyph: "⎇",  bg: "#161616",                                                                                          quip: "for when the CLI loses an argument" },
  { id: "claude",   label: "Claude Desktop",  iconSlug: "claude",           colorFile: "claude.svg",            glyph: "AI",  bg: "oklch(0.55 0.14 35)",                                                                              quip: "currently waiting for the usage limit to reset" },
  { id: "spotify",  label: "Spotify",         iconSlug: "spotify",          colorFile: "spotify.svg",           glyph: "\u266A", bg: "oklch(0.65 0.16 145)",                                                                          quip: "lo-fi loops · always" },
  { id: "outlook",  label: "Outlook",         iconSlug: "microsoftoutlook", colorFile: "outlook.svg",           glyph: "M",   bg: "oklch(0.5 0.14 240)",                                                                              quip: "subscribed to a daily internship-postings email list — building a pipeline to auto-ingest the postings, scrape the sites, and generate tailored resumes + cover letters" },
];

/* ---------- Window manager state ---------- */

function useWindowManager(viewport) {
  const [wins, setWins] = useState([]);
  const [zCounter, setZCounter] = useState(10);
  const winIdRef = useRef(1);

  const focus = useCallback((id) => {
    setZCounter(z => {
      const nz = z + 1;
      setWins(ws => ws.map(w => w.id === id ? { ...w, z: nz, focused: true } : { ...w, focused: false }));
      return nz;
    });
  }, []);

  const open = useCallback((spec) => {
    // spec: { app, arg, key? }
    const key = spec.key || (spec.app + (spec.arg ? ":" + spec.arg : ""));
    const meta = APPS[spec.app];
    if (!meta && spec.app !== "terminal") return;

    setWins(prev => {
      // if already open, focus + un-minimize
      const existing = prev.find(w => w.key === key);
      if (existing) {
        setZCounter(z => z + 1);
        return prev.map(w => w.key === key
          ? { ...w, z: zCounter + 1, minimized: false, focused: true }
          : { ...w, focused: false });
      }
      // otherwise open new
      const id = winIdRef.current++;
      const isTerminal = spec.app === "terminal";

      // size + initial position
      let w, h;
      if (isTerminal) { w = 1060; h = 710; }
      else if (spec.app === "resume") { w = 1040; h = 870; }
      else if (spec.app === "projects" || spec.app === "blog") { w = 1040; h = 780; }
      else if (spec.app === "contact") { w = 480; h = 340; }
      else { w = 970; h = 730; }

      // viewport-based default layout
      const vw = viewport.w, vh = viewport.h;
      w = Math.min(w, vw - 60);
      // Clamp height so windows don't extend past the dock at the bottom.
      const maxH = vh - MENUBAR_H - DOCK_H - 40;
      h = Math.min(h, maxH);

      // stagger to avoid overlap
      const offset = (prev.length % 6) * 28;
      let x, y;
      if (isTerminal) {
        // Center the terminal horizontally and vertically within the usable
        // region (between the menubar and the dock) so the bottom is never cut off.
        x = Math.max(30, Math.round((vw - w) / 2));
        y = MENUBAR_H + Math.max(10, Math.round((vh - MENUBAR_H - DOCK_H - h) / 2));
      } else {
        // place to the right of the terminal if it exists
        const term = prev.find(w => w.app === "terminal");
        if (term) {
          x = Math.min(vw - w - 30, term.x + term.w + 24 + offset);
          y = Math.max(40, term.y + offset);
          if (x + w > vw - 10) {
            x = Math.max(30, vw - w - 30);
            y = term.y + 40 + offset;
          }
        } else {
          x = Math.max(30, Math.round((vw - w) / 2)) + offset;
          y = Math.max(40, Math.round((vh - h) / 3)) + offset;
        }
      }

      const title = isTerminal ? "michael@portfolio: ~ — bash" : (meta.title + (spec.arg ? " — " + spec.arg : ""));

      const newZ = zCounter + 1;
      setZCounter(newZ);
      const newWin = {
        id, key, app: spec.app, arg: spec.arg,
        title, x, y, w, h, z: newZ,
        minimized: false, focused: true,
      };
      return prev.map(p => ({ ...p, focused: false })).concat(newWin);
    });
  }, [viewport, zCounter]);

  const close = useCallback((id) => {
    setWins(prev => prev.filter(w => w.id !== id));
  }, []);

  const move = useCallback((id, pos) => {
    setWins(prev => prev.map(w => w.id === id ? { ...w, ...pos } : w));
  }, []);

  const resize = useCallback((id, box) => {
    setWins(prev => prev.map(w => w.id === id ? { ...w, ...box } : w));
  }, []);

  const toggleFullscreen = useCallback((id) => {
    setWins(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.fullscreen) {
        const restore = w.preFullscreen || { x: w.x, y: w.y, w: w.w, h: w.h };
        return { ...w, fullscreen: false, ...restore, preFullscreen: undefined };
      }
      const padding = 8;
      return {
        ...w,
        fullscreen: true,
        preFullscreen: { x: w.x, y: w.y, w: w.w, h: w.h },
        x: padding,
        y: padding,
        w: viewport.w - padding * 2,
        h: viewport.h - MENUBAR_H - DOCK_H - padding,
      };
    }));
  }, [viewport]);

  const minimize = useCallback((id) => {
    setWins(prev => prev.map(w => w.id === id ? { ...w, minimizing: true } : w));
    setTimeout(() => {
      setWins(prev => prev.map(w => w.id === id ? { ...w, minimized: true, minimizing: false } : w));
    }, 200);
  }, []);

  return { wins, open, close, focus, move, resize, minimize, toggleFullscreen };
}

/* ---------- Menu bar / dock ---------- */

function BrandMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="brand-menu" ref={ref}>
      <button
        className="brand-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="About Michael"
      >
        <ProfilePhoto
          src={AVATAR_PHOTO}
          alt="Michael Lei"
          className="mb-brand-img"
          placeholderClass="mb-brand-placeholder"
          placeholder="ML"
        />
      </button>
      {open && (
        <div className="brand-card">
          Future-ready engineer who likes building AI-augmented software that real organizations and the people inside them actually use.
        </div>
      )}
    </div>
  );
}

function MenuBar({ openWindow, openWins }) {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime(new Date())), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const isOpen = (app) => openWins.some(w => w.app === app && !w.minimized);

  return (
    <div className="menubar">
      <BrandMenu />
      <span className="mb-name">Michael Lei</span>
      <span className="mb-sep">·</span>
      {DOCK_ITEMS.filter(it => it.id !== "resume").map((it) => (
        <span
          key={it.id}
          className={`mb-nav ${isOpen(it.id) ? "open" : ""}`}
          onClick={() => openWindow({ app: it.id })}
        >
          {it.label}
        </span>
      ))}
      <span className="mb-spacer"></span>
      <div className="mb-right">
        <button
          type="button"
          className={`mb-resume-cta ${isOpen("resume") ? "open" : ""}`}
          onClick={() => openWindow({ app: "resume" })}
          title="View resume"
        >
          <span>Resume</span>
          <span className="mb-resume-arrow">↓</span>
        </button>
        <span><span className="mb-status-dot"></span>online</span>
        <span>{time}</span>
      </div>
    </div>
  );
}

function formatTime(d) {
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}  ${t}`;
}

const STI_BASE = "https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons@master/images/svg/";

// Inline SVGs for apps without a reliable CDN source (or where the CDN
// is commonly blocked). Cursor's official mark is a beveled cube.
const INLINE_BRANDS = {
  cursor: (
    <svg viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" className="rd-brand">
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  ),
};

function BrandIcon({ id, colorFile, slug, glyph }) {
  const inline = INLINE_BRANDS[id];
  const initial = inline ? "inline" : (colorFile ? "color" : (slug ? "mono" : "glyph"));
  const [stage, setStage] = useState(initial);
  if (stage === "inline") return inline;
  if (stage === "color") {
    return (
      <img
        src={STI_BASE + colorFile}
        alt=""
        className="rd-brand rd-brand-color"
        onError={() => setStage(slug ? "mono" : "glyph")}
        draggable={false}
      />
    );
  }
  if (stage === "mono") {
    return (
      <img
        src={`https://cdn.simpleicons.org/${slug}/ffffff`}
        alt=""
        className="rd-brand"
        onError={() => setStage("glyph")}
        draggable={false}
      />
    );
  }
  return <span className="rd-glyph">{glyph}</span>;
}

function RealDock({ onQuip }) {
  return (
    <div className="real-dock">
      {REAL_APPS.map((app) => {
        const transparent = !!app.colorFile;
        return (
          <div
            key={app.id}
            className="real-dock-item"
            onClick={() => onQuip(app)}
            title={app.label}
          >
            <div
              className={`rd-icon ${transparent ? "rd-icon-bare" : ""}`}
              style={transparent ? undefined : { background: app.bg }}
            >
              <BrandIcon id={app.id} colorFile={app.colorFile} slug={app.iconSlug} glyph={app.glyph} />
            </div>
            <span className="rd-tooltip">{app.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AppModal({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [msg, onClose]);

  if (!msg) return null;
  return (
    <div className="app-modal-overlay" onClick={onClose} key={msg.id}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <div className="window-chrome">
          <div className="win-dots">
            <span className="win-dot r" onClick={onClose} title="close"><span>×</span></span>
            <span className="win-dot y inert"><span>−</span></span>
            <span className="win-dot g inert"><span>↗</span></span>
          </div>
          <div className="win-title">{msg.label}</div>
        </div>
        <div className="app-modal-body">
          <div className="app-modal-icon" style={{ background: msg.bg }}>
            <span className="rd-glyph">{msg.glyph}</span>
          </div>
          <div className="app-modal-name">{msg.label}</div>
          <div className="app-modal-quip">{msg.quip}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- App ---------- */

function App() {
  const onRunRef = useRef(null);

  const [appModal, setAppModal] = useState(null);
  const showQuip = useCallback((app) => {
    setAppModal({
      id: Date.now(),
      label: app.label,
      quip: app.quip,
      glyph: app.glyph,
      bg: app.bg,
    });
  }, []);
  const triggerApp = useCallback((id) => {
    const app = REAL_APPS.find(a => a.id === id);
    if (app) showQuip(app);
  }, [showQuip]);
  const closeAppModal = useCallback(() => setAppModal(null), []);

  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const wm = useWindowManager(viewport);
  const wmRef = useRef(wm);
  wmRef.current = wm;

  // Open terminal on boot
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    setTimeout(() => wmRef.current.open({ app: "terminal" }), 250);
  }, []);

  const downloadResume = useCallback(() => {
    const a = document.createElement("a");
    a.href = "/resumes/master.pdf";
    a.download = "michael-lei-resume.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // stable open callback
  const openWindow = useCallback((spec) => { wmRef.current.open(spec); }, []);

  // Build app body for a window
  const renderBody = (w) => {
    if (w.app === "terminal") {
      return <Terminal onRunRef={onRunRef} openWindow={openWindow} triggerApp={triggerApp} />;
    }
    const meta = APPS[w.app];
    if (!meta) return null;
    const Comp = meta.comp;
    const extra = w.app === "resume" ? { onDownload: downloadResume } : {};
    return <Comp arg={w.arg} openWindow={openWindow} {...extra} />;
  };

  // Render dock label-aware open state
  const visibleWins = wm.wins.filter(w => !w.minimized);

  return (
    <div className="screen">
      <MenuBar
        openWindow={openWindow}
        openWins={visibleWins}
      />

      <div className="desktop">
        {/* Desktop file shortcuts */}
        <div className="desktop-icons">
          <div className="desktop-icon" onClick={() => openWindow({ app: "resume" })}>
            <div className="icon-glyph" style={{color: "var(--accent)"}}>{DOCK_ICONS.fileText}</div>
            <div className="icon-label">resume.pdf</div>
          </div>
          <div className="desktop-icon" onClick={() => openWindow({ app: "projects" })}>
            <div className="icon-glyph" style={{color: "var(--blue)"}}>{DOCK_ICONS.folder}</div>
            <div className="icon-label">projects/</div>
          </div>
          <div className="desktop-icon" onClick={() => openWindow({ app: "blog" })}>
            <div className="icon-glyph" style={{color: "var(--purple)"}}>{DOCK_ICONS.pen}</div>
            <div className="icon-label">writing/</div>
          </div>
          <div className="desktop-icon" onClick={() => openWindow({ app: "about" })}>
            <div className="icon-glyph" style={{color: "var(--green)"}}>{DOCK_ICONS.user}</div>
            <div className="icon-label">about.md</div>
          </div>
          <div className="desktop-icon" onClick={() => openWindow({ app: "contact" })}>
            <div className="icon-glyph" style={{color: "var(--accent-2)"}}>{DOCK_ICONS.mail}</div>
            <div className="icon-label">contact.md</div>
          </div>
        </div>

        {wm.wins.length === 0 && (
          <div className="empty-desktop-hint">
            click a section in the menu bar, or double-click a file on the desktop
          </div>
        )}

        {wm.wins.filter(w => !w.minimized).map(w => (
          <Window
            key={w.id}
            win={w}
            onFocus={wm.focus}
            onClose={wm.close}
            onMove={wm.move}
            onResize={wm.resize}
            onMinimize={wm.minimize}
            onToggleFullscreen={wm.toggleFullscreen}
          >
            {renderBody(w)}
          </Window>
        ))}
      </div>

      <RealDock onQuip={showQuip} />
      <AppModal msg={appModal} onClose={closeAppModal} />
    </div>
  );
}

/* The island entrypoint. Astro injects the FS tree as a JSON prop at build time;
   we install it into the FS module before App's children render so getNode() works
   on first paint. */
function PortfolioRoot({ fsTree }) {
  // Install once, before any child that calls getNode() mounts.
  const installed = useRef(false);
  if (!installed.current) {
    setFS(fsTree);
    installed.current = true;
  }

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile ? <Mobile /> : <App />;
}

export default PortfolioRoot;
export { App };
