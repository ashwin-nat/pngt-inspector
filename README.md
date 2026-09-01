# pngt Inspector

A standalone, browser-only tool for inspecting `.pngt` files. Drop a file in
and navigate its structure — no backend, no upload, nothing leaves the browser.

It exists to answer *"is this file shaped the way the spec says it should be"*
after changes to the file writer. It is a **structure verification tool first**:
keys, nesting, dtypes, array lengths, and file presence. Raw sensor values are
available but deliberately one click away.

## Usage

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve the built output
```

Open the page and drop a `.pngt` file onto the header (or click to browse).

- **Left pane** — the ZIP structure, with per-file size and type.
- **Right pane** — the selected file's contents:
  - `.json` renders as a tree, top level expanded and everything below
    collapsed, so the shape of the file is visible at a glance. Each row shows
    its JSON type.
  - `.npz` renders as a name / dtype / shape summary — one row per array. Click
    a row for that array's raw values.

Both panes are the same `react-arborist` tree, so expand/collapse and keyboard
navigation behave identically in each.

### What it flags

- **Array length mismatches** within an `.npz` — arrays in one lap should share
  a sample count, so a disagreement gets a banner and the outlier rows are
  marked.
- **Malformed JSON** — shows the parse error alongside the raw text.
- **Unreadable `.npz` members** — scoped to that array; the rest of the file
  stays browsable.

There is no format or version validation on load. A malformed file is often
exactly what's being debugged, so the tool doesn't gate on the checks the real
app enforces — if it's a readable ZIP, you can browse it.

## Notes on NPY parsing

`.npz` files are ZIPs of `.npy` members, unzipped with `fflate` and decoded via
`npyjs`.

`src/lib/parseNpy.ts` reads the NPY header itself rather than relying on npyjs
for it. npyjs throws on any dtype outside its table — `bool` among them — which
would take the dtype and shape down with it, and those two fields are the whole
point of this tool. Reading the header separately means an unsupported dtype
degrades to "structure shown, values unavailable" instead of blanking the
summary. Value decoding still goes through npyjs, and its result is used only
when the typed array it produced matches the one the dtype descriptor calls for
(it maps some unsigned dtypes onto signed constructors).

## Deployment

Vercel, zero-config: it auto-detects Vite, builds with `vite build`, and serves
`dist/`. Every push to `main` redeploys.

For the `inspector.pitsngiggles.com` subdomain: deploy first and confirm the
`*.vercel.app` URL works, then add the domain in **Settings → Domains** and
create a **CNAME** record in GoDaddy with host `inspector` pointing at the exact
target Vercel shows on the domain card. Subdomains use CNAME, not the A records
an apex domain needs. SSL is provisioned automatically once DNS verifies.

## Scope

Read-only inspection. No charting, no lap comparison, no export, no editing,
no side-by-side diffing — the real app's telemetry viewer is where trends get
looked at.
