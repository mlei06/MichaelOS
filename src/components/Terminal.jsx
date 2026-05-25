/* ============================================================
   Terminal — runs inside a Window. Calls openWindow() to surface
   structured content in adjacent windows.
   ============================================================ */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getNode, resolvePath, displayPath, formatSize } from '../lib/fs.ts';

const ASCII_LOGO = `   __  __ _      _                _
  |  \\/  (_)__ _| |_  __ _ ___ __| |
  | |\\/| | / _\` | ' \\/ _\` / -_) _\` |
  |_|  |_|_\\__,_|_||_\\__,_\\___\\__,_|
   L  E  I    \u00b7    duke ECE+CS '28`;

function countChildren(parts) {
  const node = getNode(parts);
  if (!node || node.type !== "dir") return 0;
  return Object.keys(node.children || {}).length;
}

function buildBootLines() {
  const projectCount = countChildren(["home", "michael", "Desktop", "projects"]);
  const blogCount = countChildren(["home", "michael", "Desktop", "blog"]);
  const projWord = projectCount === 1 ? "project" : "projects";
  const blogWord = blogCount === 1 ? "blog post" : "blog posts";
  return [
    "[ [g_OK[/] ] booting michaelOS 26.04 LTS",
    "[ [g_OK[/] ] mounting /home/michael",
    "[ [g_OK[/] ] starting recruiter-friendly-shim.service",
    `[ [g_OK[/] ] indexing ${projectCount} ${projWord}, ${blogCount} ${blogWord}`,
    "[ [a_..[/] ] checking for new opportunities ...",
    "[ [g_OK[/] ] open to Summer / New-Grad 2026 SWE roles",
    "",
    "Welcome. Try these three to get around:",
    "  [a_ls[/]     [d_list what's here[/]",
    "  [a_cd <dir>[/]   [d_step into a folder ( [/][a_cd projects[/][d_ )[/]",
    "  [a_cat <file>[/]   [d_open a file ( [/][a_cat about.md[/][d_ )[/]",
    "",
    "Tip: [d_Tab[/] autocompletes, [d_↑/↓[/] walks history, click any [a_orange link[/] to run it.",
    "New to bash? Run [a_tutorial[/] for a 90-second tour, or [a_help[/] for the full command list.",
    "",
  ];
}

function renderInline(text, onClick) {
  if (text == null) return null;
  const re = /\u001b\[([gadbrFD])_([^\u001b]+)\u001b\[\/\]/g;
  const out = []; let last = 0; let m; let key = 0;
  const map = { g: "ok", a: "accent", d: "dim", b: "link", r: "err" };
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const code = m[1];
    const inner = m[2];
    if (code === "F" || code === "D") {
      // Clickable file/dir entry from ls output.
      // inner is the absolute-ish path; display is the basename.
      const basename = inner.split("/").filter(Boolean).pop() || inner;
      const display = code === "D" ? basename + "/" : basename;
      const cmd = code === "F" ? `cat ${inner}` : `ls ${inner}`;
      const cls = code === "F" ? "click-cmd file" : "click-cmd dir-click";
      out.push(React.createElement("span", {
        key: key++, className: cls, onClick: onClick ? () => onClick(cmd) : undefined,
      }, display));
    } else if (map[code] === "accent" && onClick) {
      out.push(React.createElement("span", {
        key: key++, className: "click-cmd", onClick: () => onClick(inner),
      }, inner));
    } else {
      out.push(React.createElement("span", { key: key++, className: map[code] }, inner));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function buildCommands({ cwdRef, setCwd, openExternal, openWindow, downloadResume, triggerApp, getHistory, neofetch }) {
  const commands = {};

  commands.help = {
    desc: "show available commands",
    run: () => {
      const rows = [
        ["ls [path]",       "list directory contents"],
        ["cd <path>",       "change directory ( ~  ..  /  all work )"],
        ["cat <file>",      "open a file in its viewer window"],
        ["pwd",             "print working directory"],
        ["tree",            "show the whole site as a tree"],
        ["open <file|url>", "open a file in a new window, or a url"],
        ["whoami",          "about Michael"],
        ["contact",         "open the contact window"],
        ["resume",          "download the resume pdf"],
        ["projects [name]", "list projects, or open one"],
        ["blog",            "list writing"],
        ["about",           "about me"],
        ["neofetch",        "system / personal info card"],
        ["tutorial",        "90-second bash tour for newcomers"],
        ["clear",           "clear the screen ( \u2303L )"],
        ["history",         "show recent commands"],
        ["help",            "this list"],
      ];
      const w = Math.max(...rows.map(r => r[0].length));
      return { output: rows.map(([c, d]) => `  \u001b[a_${c.padEnd(w)}\u001b[/]  \u001b[d_${d}\u001b[/]`).join("\n") };
    }
  };

  commands.ls = {
    run: (args) => {
      const flags = args.filter(a => a.startsWith("-")).join("");
      const longFmt = flags.includes("l");
      const positional = args.filter(a => !a.startsWith("-"))[0] || "";
      const parts = resolvePath(cwdRef.current, positional);
      const node = getNode(parts);
      if (!node) return { output: `\u001b[r_ls: ${positional}: no such file or directory\u001b[/]` };
      if (node.type === "file") return { output: positional };
      const entries = Object.entries(node.children);
      if (!entries.length) return { output: "" };
      const base = displayPath(parts);
      const fullOf = (name) => base === "~" ? `~/${name}` : (base.endsWith("/") ? base + name : base + "/" + name);
      if (longFmt) {
        const lines = entries.map(([name, n]) => {
          const isDir = n.type === "dir";
          const perms = isDir ? "drwxr-xr-x" : "-rw-r--r--";
          const size = isDir ? "  -  " : formatSize(n.size || 0).padStart(5);
          const mtime = (n.modified || "May 12 2026").padEnd(11);
          const display = isDir
            ? `\u001b[D_${fullOf(name)}\u001b[/]`
            : `\u001b[F_${fullOf(name)}\u001b[/]`;
          return `${perms}  michael  staff  ${size}  ${mtime}  ${display}`;
        });
        return { output: lines.join("\n") };
      }
      const cells = entries.map(([name, n]) => n.type === "dir"
        ? `\u001b[D_${fullOf(name)}\u001b[/]`
        : `\u001b[F_${fullOf(name)}\u001b[/]`);
      return { output: cells.join("   ") };
    }
  };

  commands.cd = {
    run: (args) => {
      const target = args[0] || "~";
      const parts = resolvePath(cwdRef.current, target);
      const node = getNode(parts);
      if (!node) return { output: `\u001b[r_cd: ${target}: no such file or directory\u001b[/]` };
      if (node.type !== "dir") return { output: `\u001b[r_cd: ${target}: not a directory\u001b[/]` };
      setCwd(parts);
      return { output: "" };
    }
  };

  commands.pwd = { run: () => ({ output: "/" + cwdRef.current.join("/") }) };

  commands.cat = {
    run: (args) => {
      const target = args[0];
      if (!target) return { output: "\u001b[r_cat: missing operand\u001b[/]" };
      const parts = resolvePath(cwdRef.current, target);
      const node = getNode(parts);
      if (!node) return { output: `\u001b[r_cat: ${target}: no such file or directory\u001b[/]` };
      if (node.type === "dir") return { output: `\u001b[r_cat: ${target}: is a directory\u001b[/]` };
      if (node.kind === "app" && node.appId) {
        if (triggerApp) triggerApp(node.appId);
        return { output: `\u001b[g_\u2192\u001b[/] launching ${target}` };
      }
      if (node.kind === "pdf") {
        downloadResume && downloadResume();
        return { output: `\u001b[g_\u2192\u001b[/] downloading resume.pdf` };
      }
      // route to well-known apps based on path. Files live under ~/Desktop,
      // so peel that off before matching.
      const rel0 = parts.slice(2);
      const relParts = rel0[0] === "Desktop" ? rel0.slice(1) : rel0;
      const rel = relParts.join("/");
      if (rel === "about.md") { openWindow({ app: "about" }); return { output: `\u001b[g_\u2192\u001b[/] opening about.md` }; }
      if (rel === "contact.md"){openWindow({ app: "contact"}); return { output: `\u001b[g_\u2192\u001b[/] opening contact.md` }; }
      const projMatch = rel.match(/^projects\/([^/]+)(\/README\.md)?$/);
      if (projMatch) {
        openWindow({ app: "project", arg: projMatch[1] });
        return { output: `\u001b[g_\u2192\u001b[/] opening ${projMatch[1]}` };
      }
      if (relParts[0] === "blog" && relParts[1]) {
        openWindow({ app: "post", arg: relParts[1] });
        return { output: `\u001b[g_\u2192\u001b[/] opening ${target}` };
      }
      return { output: node.content || "" };
    }
  };

  commands.clear = { run: () => ({ output: "", clear: true }) };

  commands.whoami = { run: () => ({ output: "Michael Lei \u2014 Duke ECE + CS (May 2028) \u00b7 ships AI-augmented tools for real teams" }) };
  commands.contact = { run: () => { openWindow({ app: "contact" }); return { output: "\u001b[g_\u2192\u001b[/] opening contact" }; } };
  commands.resume  = { run: () => { downloadResume && downloadResume(); return { output: "\u001b[g_\u2192\u001b[/] downloading resume.pdf" }; } };
  commands.blog    = { run: () => { openWindow({ app: "blog" });    return { output: "\u001b[g_\u2192\u001b[/] opening blog" }; } };
  commands.about   = { run: () => { openWindow({ app: "about" });   return { output: "\u001b[g_\u2192\u001b[/] opening about" }; } };
  commands.now     = commands.about;

  commands.tutorial = {
    run: () => {
      openWindow({ app: "post", arg: "2026-05-bash-quick-tour.md" });
      return { output: "\u001b[g_\u2192\u001b[/] opening bash tutorial" };
    }
  };
  commands.bash = commands.tutorial;

  commands.projects = {
    run: (args) => {
      if (args[0]) {
        const node = getNode(["home","michael","Desktop","projects", args[0]]);
        if (!node) return { output: `\u001b[r_projects: ${args[0]}: no such project\u001b[/]` };
        openWindow({ app: "project", arg: args[0] });
        return { output: `\u001b[g_\u2192\u001b[/] opening project ${args[0]}` };
      }
      openWindow({ app: "projects" });
      const projectsDir = getNode(["home", "michael", "Desktop", "projects"]);
      const lines = Object.entries(projectsDir.children).map(([k, v]) => {
        const m = v.meta;
        return `  \u001b[a_${k.padEnd(14)}\u001b[/]  \u001b[d_${m.year}\u001b[/]  ${m.blurb}`;
      });
      return { output: "projects/\n" + lines.join("\n") };
    }
  };

  commands.tree = {
    run: () => {
      const renderTree = (node, prefix = "", isLast = true, name = "") => {
        let out = "";
        if (name) {
          const connector = isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 ";
          const display = node.type === "dir" ? `\u001b[b_${name}/\u001b[/]` : `\u001b[a_${name}\u001b[/]`;
          out += prefix + connector + display + "\n";
        }
        if (node.type === "dir") {
          const entries = Object.entries(node.children);
          entries.forEach(([k, v], i) => {
            const last = i === entries.length - 1;
            const newPrefix = name ? prefix + (isLast ? "    " : "\u2502   ") : prefix;
            out += renderTree(v, newPrefix, last, k);
          });
        }
        return out;
      };
      const root = getNode(["home", "michael"]);
      return { output: "\u001b[b_~\u001b[/]\n" + renderTree(root).replace(/\n$/, "") };
    }
  };

  commands.history = {
    run: () => {
      const h = getHistory().filter(x => x.kind === "cmd" && x.cmd);
      return { output: h.map((c, i) => `  ${String(i + 1).padStart(3)}  ${c.cmd}`).join("\n") };
    }
  };

  commands.neofetch = { run: () => ({ output: neofetch(), raw: true }) };
  commands.echo = { run: (args) => ({ output: args.join(" ") }) };

  commands.open = {
    run: (args) => {
      const target = args[0];
      if (!target) return { output: "\u001b[r_open: missing operand\u001b[/]" };
      if (/^https?:\/\//.test(target)) {
        openExternal(target);
        return { output: `\u001b[g_\u2192\u001b[/] opening ${target} in a new tab` };
      }
      return commands.cat.run([target]);
    }
  };


  // ---- destructive / system commands: quippy responses ----
  const quip = (line) => ({ output: line });

  commands.sudo = { run: (args) => quip(
    args[0] === "rm"
      ? "\u001b[r_sudo: even root respects a portfolio site.\u001b[/]"
      : "\u001b[d_michael is not in the sudoers file. This incident will be reported.\u001b[/]"
  )};

  commands.rm = {
    run: (args) => {
      const joined = args.join(" ");
      // recursive deletion of everything
      if (joined.match(/(-r|-rf|-fr)\s*\/(\s|$)/) || joined === "-rf /" || joined === "-rf /*") {
        return quip("\u001b[r_rm: refusing to remove '/' \u2014 someone has to host my portfolio.\u001b[/]");
      }
      if (joined.includes("-rf") || joined.includes("-fr")) {
        return quip(`\u001b[r_rm: '${joined}'? confident energy. shame the filesystem is read-only.\u001b[/]`);
      }
      if (!joined.trim()) {
        return quip("\u001b[r_rm: missing operand. and honestly, leave it alone.\u001b[/]");
      }
      return quip(`\u001b[r_rm: cannot remove '${joined}': read-only filesystem.\u001b[/]\n\u001b[d_(this is a portfolio. if you'd like to delete something, send me an email and i'll consider it.)\u001b[/]`);
    }
  };

  commands.mv = { run: (args) => quip(`\u001b[r_mv: read-only filesystem.\u001b[/] \u001b[d_(also: i alphabetize things. please don't.)\u001b[/]`) };
  commands.cp = { run: () => quip(`\u001b[r_cp: read-only filesystem.\u001b[/] \u001b[d_(but feel free to right-click \u2192 view source.)\u001b[/]`) };
  commands.chmod = { run: () => quip("\u001b[d_chmod: permissions are vibes here. everything is 644 and we like it that way.\u001b[/]") };
  commands.chown = { run: () => quip("\u001b[d_chown: i already own everything in /home/michael, thanks.\u001b[/]") };

  commands.nano = {
    run: (args) => quip(`\u001b[d_nano: not installed. try \u001b[/]\u001b[a_cat ${args[0] || "<file>"}\u001b[/]\u001b[d_ \u2014 same energy, fewer keystrokes.\u001b[/]`)
  };
  commands.vim = {
    run: (args) => quip(`\u001b[d_E382: vim was eaten by emacs. try \u001b[/]\u001b[a_cat ${args[0] || "<file>"}\u001b[/]`)
  };
  commands.vi = commands.vim;
  commands.emacs = {
    run: () => quip("\u001b[d_emacs: a great operating system, lacking only a decent text editor.\u001b[/]")
  };

  commands.dd = { run: () => quip("\u001b[r_dd: please don't image my hard drive.\u001b[/] \u001b[d_(8.7 GiB of half-finished projects. you'd be disappointed.)\u001b[/]") };
  commands.mkfs = { run: () => quip("\u001b[r_mkfs: ...you know this is a portfolio site, right?\u001b[/]") };
  commands.format = commands.mkfs;
  commands.fdisk = commands.mkfs;

  commands.kill = { run: (args) => quip(`\u001b[r_kill: cannot signal '${args.join(" ") || "<pid>"}': we're not that kind of process.\u001b[/]`) };
  commands.pkill = commands.kill;
  commands.killall = commands.kill;

  commands.shutdown = { run: () => quip("\u001b[d_shutdown: this is a webpage. closing the tab does the same thing, and i won't take it personally.\u001b[/]") };
  commands.reboot = { run: () => quip("\u001b[d_reboot: try the \u001b[/]\u001b[a_Tweaks \u2192 reboot\u001b[/]\u001b[d_ button. less disruptive.\u001b[/]") };
  commands.halt = commands.shutdown;
  commands.poweroff = commands.shutdown;

  commands[":(){:|:&};:"] = { run: () => quip("\u001b[r_fork: resource temporarily unavailable.\u001b[/] \u001b[d_(classic. but no.)\u001b[/]") };

  commands.exit = { run: () => quip("\u001b[d_nice try. close the tab if you really mean it.\u001b[/]") };
  commands.logout = commands.exit;
  commands.quit = commands.exit;

  commands.man = { run: (args) => quip(`\u001b[d_No manual entry for ${args[0] || ""}. Try \u001b[/]\u001b[a_help\u001b[/]\u001b[d_.\u001b[/]`) };

  commands.touch = {
    run: (args) => quip(args[0]
      ? `\u001b[r_touch: cannot create '${args[0]}': read-only filesystem.\u001b[/] \u001b[d_(every file here was placed deliberately.)\u001b[/]`
      : "\u001b[r_touch: missing file operand.\u001b[/]")
  };
  commands.mkdir = {
    run: (args) => quip(`\u001b[r_mkdir: cannot create directory '${args[0] || ""}': read-only filesystem.\u001b[/]`)
  };

  commands.code = {
    run: (args) => quip(args[0]
      ? `\u001b[d_code: would open '${args[0]}' in VS Code if this were a real machine. try \u001b[/]\u001b[a_cat ${args[0]}\u001b[/]\u001b[d_ instead.\u001b[/]`
      : "\u001b[d_code: editor not available in this simulation. (also: i've mostly migrated to cursor.)\u001b[/]")
  };
  commands.cursor = {
    run: (args) => quip(args[0]
      ? `\u001b[d_cursor: would open '${args[0]}' if this were a real machine. for now: \u001b[/]\u001b[a_cat ${args[0]}\u001b[/]`
      : "\u001b[d_cursor: not running in the browser. you're already using its prompt though \u2014 hi.\u001b[/]")
  };
  commands.subl = commands.code;
  commands.zed = commands.cursor;

  return commands;
}

function NeofetchCard() {
  return (
    <div style={{display:"flex", gap:"22px", alignItems:"flex-start", flexWrap:"wrap"}}>
      <pre className="ascii-art">{ASCII_LOGO}</pre>
      <div style={{fontFamily:"var(--mono)", fontSize:"12px", lineHeight:1.7}}>
        <div><span className="accent">user</span>      michael@portfolio</div>
        <div><span className="accent">os</span>        michaelOS 26.04 LTS</div>
        <div><span className="accent">kernel</span>    duke-ece-cs-2028</div>
        <div><span className="accent">github</span>    github.com/mlei06</div>
        <div><span className="accent">shell</span>     bash 5.2 (with manners)</div>
        <div><span className="accent">editor</span>    cursor + neovim</div>
        <div><span className="accent">langs</span>     ts \u00b7 python \u00b7 swift \u00b7 c++ \u00b7 java \u00b7 rust</div>
        <div><span className="accent">infra</span>     postgres \u00b7 mcp \u00b7 docker \u00b7 elasticsearch \u00b7 fastapi</div>
        <div><span className="accent">status</span>    <span className="ok">\u25cf</span> open to swe roles, summer + new-grad '26</div>
        <div style={{marginTop:"6px"}}>
          <span className="dim">type </span><span className="accent">help</span><span className="dim"> to get started.</span>
        </div>
      </div>
    </div>
  );
}

function Prompt({ parts }) {
  return (
    <span style={{display: "inline"}}>
      <span className="ps1-user">michael</span>
      <span className="ps1-at">@</span>
      <span className="ps1-host">portfolio</span>
      <span className="ps1-colon">:</span>
      <span className="ps1-path">{displayPath(parts)}</span>
      <span className="ps1-dollar"> $ </span>
    </span>
  );
}

function autocomplete(input, cwd, commands) {
  if (!input) return null;
  const tokens = input.split(/\s+/);
  if (tokens.length === 1) {
    const candidates = Object.keys(commands).filter(c => c.startsWith(tokens[0]));
    if (candidates.length === 1) return candidates[0] + " ";
    if (candidates.length > 1) return commonPrefix(candidates);
    return null;
  }
  const last = tokens[tokens.length - 1];
  const slash = last.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : last.slice(0, slash + 1);
  const filePart = slash === -1 ? last : last.slice(slash + 1);
  const baseParts = resolvePath(cwd, dirPart);
  const baseNode = getNode(baseParts);
  if (!baseNode || baseNode.type !== "dir") return null;
  const names = Object.keys(baseNode.children).filter(n => n.startsWith(filePart));
  if (!names.length) return null;
  let completion;
  if (names.length === 1) {
    const n = names[0];
    const node = baseNode.children[n];
    completion = dirPart + n + (node.type === "dir" ? "/" : " ");
  } else {
    completion = dirPart + commonPrefix(names);
  }
  tokens[tokens.length - 1] = completion;
  return tokens.join(" ");
}

function commonPrefix(arr) {
  if (!arr.length) return "";
  let p = arr[0];
  for (const s of arr) { while (s.indexOf(p) !== 0) p = p.slice(0, -1); }
  return p;
}

function Terminal({ onRunRef, openWindow, downloadResume, triggerApp }) {
  const [cwd, setCwd] = useState(["home", "michael", "Desktop"]);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;

  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  historyRef.current = history;

  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [booted, setBooted] = useState(false);
  const [bootLines, setBootLines] = useState([]);

  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  const openExternal = useCallback((url) => { window.open(url, "_blank"); }, []);

  const commands = useMemo(() => buildCommands({
    cwdRef, setCwd, openExternal, openWindow, downloadResume, triggerApp,
    getHistory: () => historyRef.current,
    neofetch: () => null,
  }), [openWindow, openExternal, downloadResume, triggerApp]);

  /* boot */
  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const lines = buildBootLines();
    const tick = () => {
      if (cancelled) return;
      if (i >= lines.length) { setBooted(true); return; }
      const lineText = lines[i];
      setBootLines(prev => [...prev, lineText]);
      i++;
      setTimeout(tick, 80 + Math.random() * 80);
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (booted && inputRef.current) inputRef.current.focus();
  }, [booted]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [history, bootLines, booted]);

  const runCommand = useCallback((rawCmd) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) {
      setHistory(h => [...h, { kind: "cmd", prompt: cwdRef.current, cmd: "" }]);
      return;
    }
    const tokens = trimmed.split(/\s+/);
    const cmd = tokens[0];
    const args = tokens.slice(1);
    const entry = { kind: "cmd", prompt: cwdRef.current, cmd: trimmed };
    setCmdHistory(prev => [...prev, trimmed]);
    setHistIdx(-1);

    let res;
    if (commands[cmd]) res = commands[cmd].run(args);
    else res = { output: `\u001b[r_${cmd}: command not found.\u001b[/] try \u001b[a_help\u001b[/]` };

    if (res.clear) { setHistory([]); return; }

    const out = { kind: "output", output: res.output, raw: res.raw, jsx: null };
    if (cmd === "neofetch") out.jsx = <NeofetchCard />;
    setHistory(h => [...h, entry, out]);
  }, [commands]);

  useEffect(() => {
    if (onRunRef) onRunRef.current = runCommand;
  }, [runCommand, onRunRef]);

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!cmdHistory.length) return;
      const next = histIdx === -1 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(cmdHistory[next] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const next = histIdx + 1;
      if (next >= cmdHistory.length) { setHistIdx(-1); setInput(""); }
      else { setHistIdx(next); setInput(cmdHistory[next]); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const completed = autocomplete(input, cwdRef.current, commands);
      if (completed) setInput(completed);
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setHistory([]);
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      setHistory(h => [...h, { kind: "cmd", prompt: cwdRef.current, cmd: input + " ^C" }]);
      setInput("");
    }
  };

  const focusInput = () => inputRef.current && inputRef.current.focus();

  return (
    <div className="term" onClick={focusInput}>
      <div className="term-body" ref={bodyRef}>
        {bootLines.map((line, i) => (
          <div key={"b" + i} className="boot-line">{renderInline(line, runCommand)}</div>
        ))}
        {history.map((h, i) => {
          if (h.kind === "cmd") {
            return (
              <div key={i} className="entry">
                <div className="prompt-line">
                  <Prompt parts={h.prompt} />
                  <span className="cmd-text">{h.cmd}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="output">
              {h.jsx ? h.jsx : renderInline(h.output, runCommand)}
            </div>
          );
        })}
        {booted && (
          <div className="input-row">
            <Prompt parts={cwd} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export { Terminal };
export default Terminal;
