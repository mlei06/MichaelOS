---
title: A 90-second bash tour (for people who got dropped into this site)
date: May 18 2026
desc: If the terminal above feels alien, here are the six commands you actually need.
published: true
---

## A 90-second bash tour

*May 18, 2026 · 4 min read*

If you landed here and the terminal feels alien, this is for you. **Bash** is the shell — the program that turns what you type into what the computer does. It's been around since 1989 and is still how most engineers move around a unix-ish machine.

You only need six commands to get the gist.

### 1. `pwd` — "where am I?"

The shell always has a *current directory* (a folder it's sitting inside). `pwd` prints it.

```
$ pwd
/home/michael
```

### 2. `ls` — "what's here?"

List the contents of the current directory.

```
$ ls
about.md  blog/  contact.md  projects/  resume.pdf
```

Add `-l` to see details (size, modified date).

```
$ ls -l projects
```

Folders end with a `/` in our prompt, files don't.

### 3. `cd` — "go somewhere"

Change directory. The shortcuts:

- `cd projects` — step into projects/
- `cd ..` — go up one level
- `cd /` — jump to the root of the filesystem
- `cd ~` — jump to home folder
- `cd` — same as `cd ~`

So `cd projects/duke-dine` walks two levels down in one go.

### 4. `cat` — "show me this file"

Print a file's contents.

```
$ cat about.md
$ cat projects/duke-dine/README.md
```

In this site, `cat`'ing a known file opens its viewer window. The menu bar does the same thing in fewer keys, but `cat` is what feels like home.

### 5. `tree` — "show me everything"

Renders the whole folder structure as an ASCII tree. Useful when you've forgotten where something lives.

### 6. `Tab` and `↑` — "type less"

These aren't commands, but they save more time than any of the above:

- **Tab** — autocompletes a file or command name
- **↑ / ↓** — walk back/forward through your history
- **Ctrl+L** — clear the screen (or type `clear`)
- **Ctrl+C** — cancel the line you're typing

If you type `cd pr` then **Tab**, the shell will fill in `cd projects/`. If two things match the prefix, hit Tab twice to see options.

### Now you try

Close this window and paste these one at a time into the terminal:

1. `pwd`
2. `ls`
3. `cd projects`
4. `ls`
5. `cd duke-dine`
6. `cat README.md`
7. `cd ~`
8. `tree`

That's enough to make any portfolio cat'd, ls'd, cd'd, and generally seen.

Type `help` in the terminal anytime to see this site's specific commands.
