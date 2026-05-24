/* Filesystem model — a virtual unix-style tree the terminal + windows navigate.
   In v1 this was loaded by fetching markdown at runtime. In v2 the tree is built
   at Astro build time from content collections and injected into the React island
   as a JSON prop, then passed to setFS() once on mount. */

export type FSFile = {
  type: 'file';
  kind: 'md' | 'pdf' | 'app';
  size: number;
  modified: string;
  download?: string;
  appId?: string;
  meta?: Record<string, unknown>;
  content: string | null;
};

export type FSDir = {
  type: 'dir';
  meta?: Record<string, unknown>;
  children: Record<string, FSNode>;
};

export type FSNode = FSFile | FSDir;

let FS: FSDir = {
  type: 'dir',
  children: { home: { type: 'dir', children: { michael: { type: 'dir', children: {} } } } },
};

export function setFS(tree: FSDir): void {
  FS = tree;
}

export function getFS(): FSDir {
  return FS;
}

export function resolvePath(cwdParts: string[], target: string): string[] {
  if (!target || target === '') return [...cwdParts];
  let parts: string[];
  if (target.startsWith('/')) {
    parts = target.split('/').filter(Boolean);
  } else if (target === '~' || target.startsWith('~/')) {
    parts = ['home', 'michael', ...target.slice(2).split('/').filter(Boolean)];
  } else {
    parts = [...cwdParts, ...target.split('/').filter(Boolean)];
  }
  const out: string[] = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') {
      out.pop();
      continue;
    }
    out.push(p);
  }
  return out;
}

export function getNode(parts: string[]): FSNode | null {
  let node: FSNode = FS;
  for (const p of parts) {
    if (node.type !== 'dir') return null;
    const next = node.children[p];
    if (!next) return null;
    node = next;
  }
  return node;
}

export function displayPath(parts: string[]): string {
  if (parts.length >= 2 && parts[0] === 'home' && parts[1] === 'michael') {
    const rest = parts.slice(2);
    return rest.length ? '~/' + rest.join('/') : '~';
  }
  return '/' + parts.join('/');
}

export function formatSize(n: number): string {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'K';
  return (n / 1024 / 1024).toFixed(1) + 'M';
}
