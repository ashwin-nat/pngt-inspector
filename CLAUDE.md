# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev        # dev server
npm run build      # tsc -b && vite build  → dist/
npm run typecheck  # types only
npm run preview    # serve the built output
```

`build` typechecks first, so a type error fails the build. There is no test
runner and no linter configured — `npm run build` is the full check.

## SPEC.md is deliberately gitignored

`SPEC.md` is the working design document and is listed in `.gitignore` on its
own instruction. Do not commit it and do not remove that ignore entry.

## What this tool is for

Verifying that a `.pngtel` file is *shaped* the way the file-format spec says —
keys, nesting, dtypes, array lengths, file presence. It is a structure
verification tool, not a data viewer. Raw sensor values are reachable but stay
one click away, behind `RawValuesModal`. Resist requests to surface values more
prominently, add charting, or add comparison/export features; those belong in
the main pits-n-giggles app. This codebase is standalone and shares nothing with
that frontend or with the separate stats explorer.

## Architecture

**Two levels of ZIP.** A `.pngtel` is a ZIP; each `.npz` inside it is *itself* a
ZIP of `.npy` members. That is why `lib/unzip.ts` exports two functions:
`unzipArchive` (async, worker-backed) for the dropped file, which can be large,
and `unzipArchiveSync` for the small in-memory `.npz` members where a worker
round-trip would cost more than it saves.

**Parse lazily, per selection.** `App.tsx` unzips once into a
`Map<path, ZipEntry>` and keeps raw bytes. `readEntry()` parses a single entry
only when its node is clicked, dispatching on file extension. Nothing is parsed
eagerly.

**One tree component, two panes.** Both `FileTree` and `JsonTree` are
`react-arborist` instances, so expand/collapse and keyboard nav behave the same
whether you are browsing archive structure or JSON content. react-arborist
virtualises rows and therefore needs *numeric* width/height, not CSS sizing —
hence `lib/useElementSize.ts` and the `width > 0 && height > 0` guard before
rendering each `<Tree>`. Removing that guard renders a zero-height tree.

### `lib/parseNpy.ts` — read this before changing it

The header is parsed here rather than by npyjs, on purpose. **Do not "simplify"
this back to a plain `npyjs.parse()` call.** Two concrete reasons:

- npyjs throws on any dtype outside its table (`bool` among them), which would
  take dtype and shape down with it — and those two fields are the entire point
  of this tool. Reading the header separately lets an unsupported dtype degrade
  to "structure shown, values unavailable" instead of blanking the summary.
- npyjs maps some unsigned dtypes onto signed constructors (`uint32` →
  `Int32Array`), which silently mis-displays large values. Decoded output is
  accepted only when its typed-array constructor matches what the dtype
  descriptor calls for; otherwise the local fallback decoder runs.

npyjs also reads the v1 header length as a `uint8` and assumes a v1 layout;
`readHeader` handles v1 (`uint16`) and v2+ (`uint32`) correctly.

### JsonTree does need a transform

The spec text claims JSON can be handed to react-arborist directly. It cannot —
react-arborist requires a stable id per node and a children array, and plain
JSON has neither. `JsonTree` maps the parsed value onto explicit nodes,
memoised per file. Top level is expanded and everything below collapsed
(`openByDefault={false}` over root-level entries) so a file's shape is visible
without scrolling.

### Controlled selection echoes back

`FileTree` selection is controlled via the `selection` prop. react-arborist
echoes that prop back through `onSelect`, so `handleSelectFile` early-returns
when the path is unchanged — without it, every click parses the entry twice.
Directories use `disableSelect` so selection always tracks what the content pane
is showing.

## Error handling philosophy

The tool must never fully break on a bad file; partial inspection stays
available. Errors are scoped as narrowly as possible — a malformed `.json`
shows its parse error *plus the raw text*, an unreadable `.npz` member becomes
one error row while its siblings still render, and a length mismatch across
arrays is surfaced as a banner because it is a real writer bug worth catching.

There is intentionally **no format or version validation on load**. A malformed
file is often exactly what is being debugged, so anything that unzips is
browsable. Do not add the checks the real app enforces.

## Level of effort

This is an internal dev inspection tool. Keep changes proportionate — there is
deliberately no test suite, and adding one is not wanted. `npm run build` is the
check. Verify parsing changes by opening a real `.pngtel` in the app.

## Deployment

Vercel, zero-config: it auto-detects Vite, builds with `vite build`, serves
`dist/`, and redeploys on every push to `main`. Target domain is
`inspector.pitsngiggles.com` via a **CNAME** (subdomain — not the A record an
apex domain would need). README.md has the DNS steps.
