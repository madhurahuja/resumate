# Resumate – resume manager

One master professional profile feeds any number of tailored resumes. A resume *references* master entries and stores only
its **overrides**, so editing one version never changes another. Exports to PDF, DOCX, TXT, Markdown, HTML and JSON are
validated after they are built. Import from PDF, DOCX, text, Markdown, Resumate JSON, and a **LinkedIn data export (.zip)**.

Vite + TypeScript + Preact (htm templates). By default, data lives in-browser (IndexedDB/localStorage). You can also connect a real Supabase database for cross-device sync.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

## Supabase integration (Google OAuth + RLS)

This app now supports a real Supabase backend with Google sign-in and row-level authorization.

### 1) Create and configure Supabase

1. Create a project in Supabase.
2. In **Authentication → Providers → Google**, enable Google and add your Google OAuth client credentials.
3. Add your app URL(s) to:
   - **Authentication → URL Configuration → Site URL**
   - **Authentication → URL Configuration → Redirect URLs**
4. In **SQL Editor**, run [supabase/schema.sql](./supabase/schema.sql).

### 2) Configure environment variables

Copy [.env.example](./.env.example) to `.env` and fill values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SUPABASE_SCHEMA=resumate
# Optional (defaults to docs)
VITE_SUPABASE_TABLE=docs
```

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, the app uses Supabase mode and requires Google sign-in. If not set, it falls back to local browser storage.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest): data model, overrides, diff, CSV/LinkedIn mapping, resume parsing |
| `npm run test:e2e` | Browser journeys (Playwright) against `dist/`. Run `npm run build` first. Set `CHROMIUM_PATH` to a Chrome/Chromium binary if Playwright cannot find one |

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, S3).

## Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project into Vercel.
3. Set build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (optional) `VITE_SUPABASE_TABLE`
5. In Supabase, add your Vercel production URL to Auth redirect settings.
6. Deploy.

## Layout

```
src/
  types.ts            Master, Resume, Section, Item, Parsed… (the data model)
  core/
    util.ts           ids, clone, small helpers
    constants.ts      page sizes, fonts, languages, countries, templates, section kinds
    model.ts          make/duplicate resumes, resolve(master, resume), override counting
    dates.ts          parsing and locale-aware formatting
    ir.ts             buildIR(): the neutral document every exporter and the preview read
    analysis.ts       diff, job-description keywords, ATS notes
    storage.ts        Store (localStorage or a host db) and the autosave queue (Saver)
    appearance.ts     colour palettes and light/dark mode
    sample.ts         clearly fictional sample profile
  export/             pdf.ts (pdfmake), docx.ts (docx), formats.ts (txt/md/html/json), validate.ts, libs.ts (lazy loaders)
  import/             text.ts (resume text → structure), linkedin.ts (CSV/ZIP), files.ts (file type routing)
  ui/                 h.ts (preact + htm), base.ts (components), sheet.ts (live preview sheet)
  views/              dashboard.ts, master.ts, editor.ts, dialogs.ts
  app.ts              state, actions, undo/redo, shell
tests/                Vitest unit tests
e2e/                  Playwright journeys + fixtures
```

Heavy libraries (pdfmake, docx, pdf.js, mammoth, jszip) are loaded on first use, so the app itself starts at ~60 KB gzipped.

## UX productivity touches

- Keyboard shortcuts: `Ctrl/Cmd + K` (quick actions), `?` (shortcuts), `N` (new resume), `/` (focus dashboard search), `1..4` (jump between main sections).
- Editor section tabs are fully keyboard navigable (`←/→`, `Home`, `End`) with proper ARIA tab wiring.
- Dialogs now consistently autofocus useful controls, trap tab navigation, and restore focus to the triggering element on close.
- Command palette (Quick actions) now supports fuzzy-ranked keyboard navigation, grouped results (Pinned, Recent, Actions, Navigation, Resumes), one-click pin/unpin favorites, and search across action names, resume metadata, and resume content text.
- Guided onboarding checklist on the dashboard for first-time setup and tailoring flow.
- Smart defaults in the New Resume dialog (country + industry driven template/language starter choices).
- Focus mode in the resume editor for distraction-free writing.
- Mobile editor ergonomics: sticky editor toolbar and tighter control spacing for easier one-hand editing.
- Reduced-motion preference is respected with minimized UI transitions and animations.
- Subtle motion polish adds character: micro-interactions on controls/cards, command-palette emphasis, dialog entrance animation, and a pulsing save indicator while saving.
- Motion is user-configurable in Appearance: **System**, **Off**, **Soft**, or **Snappy**.
- Inline bullet-writing hints that nudge toward stronger, measurable impact statements.
- Export dialog includes a pre-export quality checklist (identity/contact/experience/impact coverage) before file download, with in-place “Fix” actions that reopen the editor on the relevant tab.
- Save status, undo/redo, and version history are built in per resume.
- Tailor tab now includes an ATS-style **Job Match Score** that combines keyword coverage, resume health, quantified bullet coverage, and repetition checks with actionable improvement prompts.
- Expanded template library now includes stronger visual options (for example Nordic, Heritage, Studio, Zen, Split Bar) in addition to the original presets.
- Design tab now supports deeper style controls beyond template defaults: header alignment, heading case/rule/color, heading tracking, and name scale/color.
- Template selection is now faster with a dedicated modal picker, live preview cards (using your own resume content), one-click favorites, and curated filters (favorites, ATS-safe, modern, 2-column).
- On small screens, dashboard filters are collapsible behind a “Show filters” toggle to reduce clutter.
- Dashboard filtering now uses a cleaner filter-builder pattern: all filters are added on demand via an “Add filter” control and removable filter chips.
- Key actions now include contextual icons across editor tabs, filters, dialogs, and confirmations to improve scanability and reduce click ambiguity.
- In the editor, the left workspace panel is now draggable/resizable on desktop and remembers your preferred width.

## Where to extend

- **Persistence / multi-device:** extend/replace the `Store` object in [src/core/storage.ts](./src/core/storage.ts). It exposes `get`, `list`, `put` and `del` by `(collection, id)`; nothing else touches storage.
- **New section type:** add an entry to `KINDS` in `core/constants.ts` (fields + display mode). Rendering, editing, export and import mapping follow the field roles.
- **New template:** add to `TEMPLATES` (same file). Preview, PDF and DOCX read the same preset.
- **New export format:** add a builder in `export/formats.ts` and register it in `EXPORTS`; add a check in `validate.ts`.
- **AI features (rewrite bullets, translate, match a job description):** call your model from a new `src/ai/` module and apply results through `A.updateResume` so they land as undoable overrides. The tailor tab already includes local resume health checks and job-description keyword matching to guide updates.

## Typing status

`tsc` runs clean, but `strict` is off and many UI props are still `any`. The data model (`types.ts`, `core/model.ts`) is typed;
the view files are the next place to tighten. Suggested order: turn on `noImplicitAny`, then type component props, then `strict`.

## Known limitations

- You can choose the resume font family in Design for preview and DOCX output. PDF export stays on embedded Roboto (Latin, Greek, Cyrillic) for reliable portability.
- Hindi/Punjabi/CJK resumes still need DOCX export.
- Page counts in the preview are approximate; the exported file is the source of truth.
- Importing is heuristic; scanned PDFs are not supported. The LinkedIn ZIP is the reliable LinkedIn route.
- Saved version history stores a resume's overrides (master text is read live) and is not part of backups.
