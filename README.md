# str(notes)

Block-based note taking for graduate CS courses, projects and research. Built with React + Vite + TipTap, stored in Supabase, deployed on Vercel.

## Features

- **Private, login-only accounts**: username + password, no public sign-up. Every row and file is protected by Row Level Security.
- **Sidebar**: collapsible *Courses / Projects / Research* sections with folders and notes. Drag notes between folders and reorder them, or drag folders between sections. Includes search (`#tag` searches tags). The sidebar can be resized, and `Ctrl/⌘ + \` hides it.
- **Folder overview**: cover, icon (the sidebar shows a line icon per kind until you pick an emoji), course code and term, a **Quick notes** scratchpad, **tasks / deadlines / reminders** with due dates, and **flagged annotations** ("to look up").
- **Notes**
  - *Standard*: a single block editor.
  - *4-zone*: four editable zones (title, icon, color). Layouts: 2×2, primary + 3, 4 columns or stacked. You can reorder and collapse zones, apply templates, or save your zones as the default. Blocks can be dragged between zones.
  - *PDF note*: upload a PDF (drop or choose, up to 50 MB). It opens on the left in the browser's built-in viewer and you take notes on the right. Drag the divider to resize; the split is saved with the note. Jump to a page, or copy a link to a specific page (`/n/<id>?page=12`).
  - Cover images (gradient, color or upload, with reposition), icons, subtitles and tags. Convert between standard and 4-zone at any time.
- **Page links**: **Copy link** in a page's ⋯ menu (top right or sidebar), then paste it into any note to get a link with the page's title. Alternatively, type `\link` (*Link to page*) or open the toolbar's link box and type a page title. Clicking a page link opens that page; Ctrl/⌘-click opens it in a new in-app tab.
- **Editor blocks** (type `\`): headings 1–4, lists, to-dos, quotes, callouts, dividers, tables, images (paste, drop or upload), syntax-highlighted code (40+ languages), KaTeX math blocks, inline math with `$…$`, and **flowcharts** (`\flowchart`): write [Mermaid](https://mermaid.js.org/syntax/flowchart.html) text with a live preview (templates for top-down / left-right flowcharts, sequence and state diagrams). Click a diagram any time to edit it.
- **Formatting toolbar**: bold, italic, underline, strike, code, sub/superscript, links, text color and highlight (presets or any hex), plus **custom text styles**. Styles can have a typing shortcut (e.g. `~my text~`, `!!exam!!`, `<<aside>>`): type the wrapper around text and it's styled instantly (undo with ⌘/Ctrl+Z). Characters the editor already uses (`*`, `_`, `` ` ``, `$`, `:`, `\`, `~~`, `#`, `-`, …) are rejected.
- **Emoji**: type `:smile` for suggestions. Upload your own **custom emojis** and use them inline, as page icons, zone icons or callout icons.
- **Annotations**: annotate a selection (💬 in the toolbar) or a whole block (⋮⋮ menu). Use the side panel to resolve, reopen or jump to a block. Tick **Show on overview** to surface an annotation on the folder page and on Home.
- **Tabs**: keep up to 5 pages open inside the app. Use **Open in new tab** in a page's or space's ⋯ menu in the sidebar, or Ctrl/⌘-click / middle-click it. The tab strip appears above the page once a second tab is open: click to switch, drag to reorder, × or middle-click to close, **+** for a new Home tab. Background tabs stay loaded, so switching never reloads a page: half-typed tasks, unsaved text, the cursor, open panels and scroll position are exactly as you left them, and task / annotation lists refresh when you come back. A note or space opens in one tab at most (opening it again jumps to that tab). Open tabs are remembered on this device.
- **Completed-task archive**: checked-off tasks, deadlines and reminders leave Home and the space lists 7 days after completion (choose *right away*, 1, 3, 7, 14 or 30 days in **Settings → Spaces & tasks** or on the archive page). Nothing is deleted. **Home → Archived tasks** (link under every task list, or `/archive`) lists them by month, filterable by space and searchable. Un-check one to restore it, or delete them for good.
- **Custom space types**: rename *Courses / Projects / Research* and choose their icons (line icon or any emoji) in **Settings → Spaces & tasks**, e.g. *Clients*, *Books*, *Trips*. Names update everywhere: sidebar, Home, new-space names, backgrounds settings.
- **Backgrounds**: Home and spaces get a subtle gradient so they stand apart from notes. Pick one for Home, all courses, all projects and all research in **Settings → Appearance**; override a single space from its **⋯ → Background…** menu. **Settings → Colors → Background intensity** sets how light every background color is (highlights, block backgrounds, callouts, zones, text styles), from *Very light* to *Strong*.
- **Settings** (synced to your account): light, dark or system theme, page width, space backgrounds, fonts and sizes per heading/body/code, line height, a **font library** (add any Google Font by name or URL, delete ones you don't use; the built-in system fonts can't be deleted and act as fallbacks), color presets, custom text styles, 4-zone defaults, custom emojis and password.

## 1 · Supabase

1. Create a project at <https://supabase.com>.
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, RLS policies, triggers and the private `hapmore` storage bucket. Running it again is safe.
   **Upgrading an existing project?** Run `schema.sql` again. It adds the `notes.page_width` column (per-note page width), the `folders.background` column (per-space gradient), allows the `pdf` note type, lets the storage bucket accept PDFs up to 50 MB, and adds `tasks.completed_at` (when a task was checked off, set by a trigger; existing completed tasks use their last-updated time) for the task archive. Until you run it, the archive falls back to each task's last-updated time. Existing settings (em-based font sizes, text styles) are migrated to px automatically on first load.
3. **Authentication → Sign In / Providers**:
   - turn **off** "Allow new users to sign up";
   - under *Email*, you can turn off "Confirm email" (users are created pre-confirmed anyway).
4. Create your login. Choose one option:
   - **Authentication → Users → Add user → Create new user**, with email `yourname@hapmore.app`, a password, and ✔ *Auto Confirm User*. You then sign in with the username `yourname`.
   - or from your machine, after running `npm install`:
     ```bash
     SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-user.mjs yourname 'a-strong-password'
     ```
     Never put the service-role key in Vercel or in any `VITE_*` variable.
5. **Project Settings → API**: copy the *Project URL* and the *anon / publishable* key.

> The username domain (`hapmore.app`) is only an internal mapping to Supabase Auth emails; no email is ever sent. To change it, set `VITE_USERNAME_DOMAIN` and create users with the matching domain. Typing a full email on the login page also works.

## 2 · Vercel

1. Push this folder to a GitHub, GitLab or Bitbucket repo, then click **Add New → Project** in Vercel and import it. Vercel detects the framework as **Vite** (build `npm run build`, output `dist`).
2. **Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |
   | `VITE_USERNAME_DOMAIN` | `hapmore.app` (optional) |

3. Deploy. `vercel.json` rewrites all paths to `index.html` so deep links like `/n/<id>` work.

`VITE_*` variables are baked in at build time, so redeploy after changing them.

## Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev                  # http://localhost:5173
npm run build && npm run preview
```

Requires Node 18+. `.npmrc` sets `legacy-peer-deps=true` so the emoji-mart React wrapper installs cleanly on React 18.

## Shortcuts

| | |
|---|---|
| `\` | block menu (slash-style command menu) |
| `:name` / `:name:` | emoji suggestions / instant emoji (incl. custom) |
| `$x^2$` or `Ctrl/⌘ + Shift + M` | inline math |
| `$$` + space | math block |
| ``` + space | code block |
| `Alt/⌘ + Shift + ↑/↓` | move block up or down |
| `Ctrl/⌘ + \` | toggle sidebar |
| Ctrl/⌘-click or middle-click | open a sidebar page/space or a page link in a new in-app tab |
| `Ctrl/⌘ + Enter` | finish editing a math block or annotation |
| Drag ⋮⋮ | move a block (also between 4-zone zones) |

## Project structure

```
src/
  App.jsx, main.jsx        routing, auth bootstrap
  store/useApp.js          Zustand store: session, folders, notes, emojis, settings, toasts
  lib/                     supabase client, storage (signed URLs), pdf, links (page links), defaults, fonts, noteTypes (Add New menu registry), wrapMatch, appearance, utils
  editor/                  TipTap editor, extensions (blocks, math, code, callout, emoji, handle, annotations)
  notes/                   4-zone note, PDF note, annotations panel, autosave hook
  pages/                   Home, Folder, Note, Tag, Settings (+ FontLibrary), Login
  components/              Sidebar, Layout, Cover, pickers, tasks, flagged annotations…
  styles/                  base.css, app.css, editor.css
supabase/schema.sql        database + storage setup
scripts/create-user.mjs    optional admin helper to create logins
```

## Data model

`folders` (course / project / research) → `notes` (standard | four_zone | pdf, TipTap JSON; PDF notes store `{ pdf: { path, name, size }, doc, split }`) → `annotations` (by `block_id`).
`tasks` belong to a folder (or none). `custom_emojis` and `user_settings` are per user. Files (images, covers, emojis, PDFs) live in the private `hapmore` bucket under `<user-id>/…` and are served through short-lived signed URLs.

> **About the name:** the app is now called **str(notes)**. Internal identifiers (the `hapmore` storage bucket, the `hapmore.app` login domain, and drag-and-drop MIME types) keep their original names, so existing projects, files and logins keep working without migration.
