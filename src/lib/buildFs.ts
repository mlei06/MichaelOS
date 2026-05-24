/* Build the virtual filesystem tree from Astro content collections at build
   time. The output mirrors what runtime filesystem.js produced in v1, so the
   React components (which read from getNode) don't need to change. */

import type { CollectionEntry } from 'astro:content';
import type { FSDir, FSNode } from './fs.ts';

type ProjectEntry = CollectionEntry<'projects'>;
type BlogEntry = CollectionEntry<'blog'>;
type PageEntry = CollectionEntry<'pages'>;

// Mirrors REAL_APPS in App.jsx (id + label). Source of truth lives there;
// only the popup-rendering metadata (quip, bg, glyph) needs the React side.
const DOCK_APPS: Array<{ id: string; label: string }> = [
  { id: 'chrome',   label: 'Chrome' },
  { id: 'docker',   label: 'Docker Desktop' },
  { id: 'cursor',   label: 'Cursor' },
  { id: 'vscode',   label: 'VS Code' },
  { id: 'valorant', label: 'Valorant' },
  { id: 'notion',   label: 'Notion' },
  { id: 'github',   label: 'GitHub Desktop' },
  { id: 'claude',   label: 'Claude Desktop' },
  { id: 'spotify',  label: 'Spotify' },
  { id: 'outlook',  label: 'Outlook' },
];

export function buildFs(opts: {
  projects: ProjectEntry[];
  blog: BlogEntry[];
  pages: PageEntry[];
  projectOrder?: string[];
}): FSDir {
  // ~/Desktop holds what used to live in ~ — pages, projects, blog, resume.
  const desktop: FSDir = { type: 'dir', children: {} };

  for (const entry of opts.pages) {
    const name = entry.id + '.md';
    desktop.children[name] = {
      type: 'file',
      kind: 'md',
      size: entry.body?.length ?? 0,
      modified: (entry.data.modified as string) ?? '—',
      meta: entry.data,
      content: entry.body ?? '',
    };
  }

  desktop.children['resume.pdf'] = {
    type: 'file',
    kind: 'pdf',
    size: 0,
    modified: 'May 22 2026',
    download: '/resumes/master.pdf',
    content: null,
  };

  const projectsDir: FSDir = { type: 'dir', children: {} };
  const byId = new Map(opts.projects.map((p) => [p.id, p]));
  const order = opts.projectOrder ?? opts.projects.map((p) => p.id);
  for (const id of order) {
    const entry = byId.get(id);
    if (!entry) continue;
    const meta = { ...entry.data, name: id };
    projectsDir.children[id] = {
      type: 'dir',
      meta,
      children: {
        'README.md': {
          type: 'file',
          kind: 'md',
          size: entry.body?.length ?? 0,
          modified: (entry.data.modified as string) ?? String(entry.data.year ?? '—'),
          content: entry.body ?? '',
        } satisfies FSNode,
      },
    };
  }
  desktop.children['projects'] = projectsDir;

  const blogDir: FSDir = { type: 'dir', children: {} };
  for (const entry of opts.blog) {
    if (entry.data.published === false) continue;
    const name = entry.id + '.md';
    blogDir.children[name] = {
      type: 'file',
      kind: 'md',
      size: entry.body?.length ?? 0,
      modified: (entry.data.date as string) ?? (entry.data.modified as string) ?? '—',
      meta: { ...entry.data, full: true },
      content: entry.body ?? '',
    };
  }
  desktop.children['blog'] = blogDir;

  // ~/applications — one launcher per dock app. Clicking in `ls` output
  // fires the same popup the bottom dock shows.
  const applicationsDir: FSDir = { type: 'dir', children: {} };
  for (const app of DOCK_APPS) {
    applicationsDir.children[app.id + '.app'] = {
      type: 'file',
      kind: 'app',
      appId: app.id,
      size: 0,
      modified: 'May 22 2026',
      content: null,
    };
  }

  const home: FSDir = {
    type: 'dir',
    children: {
      Desktop: desktop,
      applications: applicationsDir,
    },
  };

  return {
    type: 'dir',
    children: {
      home: { type: 'dir', children: { michael: home } },
    },
  };
}
