# AgrabanArt — Portfolio Site

Personal digital portfolio for Mohamad Raziqaiman Bin Mohd Yazid (AgrabanArt).
Static HTML/CSS/JS site — no build tools required, hosted on GitHub Pages.

## Folder structure

```
portfolio-site/
├── index.html               Home — looping background video + tagline (CMS-editable)
├── projects.html            2D Illustrations / 3D Modelling / Animation Showreel (live data, 6-item cap each)
├── project-template.html    Dynamic detail page — reads ?id= and fetches from Supabase
├── events.html               Awards / Exhibitions & Competitions (live data)
├── contact.html              Photo, link buttons, resume/CV download (all CMS-editable)
├── style.css                 Shared design system (colors, type, layout)
├── script.js                 Shared behavior (nav, carousels, animations)
├── site-data.js               Fetches Supabase content into every public page
├── config.js                  Supabase + Cloudflare connection details (fill this in)
├── cms.html                   Admin dashboard — add/edit/delete content here
├── cms.css                    Admin dashboard styles
├── cms.js                      Admin dashboard logic (auth, CRUD, uploads, trash)
├── supabase-schema.sql         Database schema — safe to re-run any time
├── cloudflare-worker/
│   ├── media-worker.js          The Worker that brokers uploads/deletes to R2
│   └── wrangler.toml             Worker deploy config
└── media/
    └── (unused — everything now goes through the CMS / R2)
```

**Important:** all files must live in the same root folder — paths in the code are relative to that root.

## Deploying to GitHub Pages

1. Create a repo on GitHub (or use an existing one).
2. Push/upload this whole folder to the repo root — keep the folder structure intact.
3. In the repo, go to **Settings → Pages**, set the source to your main branch (root folder).
4. Your site goes live at `https://your-username.github.io/repo-name/`.

## Setting up the CMS (one-time)

Built on three pieces: **Supabase** (login + database), a **Cloudflare Worker** (a safe go-between), and **Cloudflare R2** (where files actually live).

### 1. Supabase (auth + database)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the entire contents of `supabase-schema.sql`, and run it. (This file is safe to re-run any time — every statement checks for existing tables/policies first, so running it again after an update won't duplicate or break anything.)
3. Go to **Authentication → Users → Add user** and create yourself an admin login.
4. Copy that user's UID, then in the SQL Editor run:
   ```sql
   insert into admins (user_id) values ('paste-your-user-uid-here');
   ```
5. Go to **Settings → API** and copy your **Project URL** and **anon public key**.

### 2. Cloudflare R2 (file storage)
1. R2 → Create bucket, e.g. `agrabanart-media`.
2. Bucket → Settings → Public Access → enable it (or connect a custom domain).
3. Note the public base URL — goes in `config.js` as `MEDIA_PUBLIC_BASE_URL`.

### 3. Cloudflare Worker
1. `npm install -g wrangler`
2. Edit `cloudflare-worker/wrangler.toml` — set your bucket name.
3. From inside `cloudflare-worker/`:
   ```
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   wrangler secret put ADMIN_EMAIL
   wrangler deploy
   ```
4. Copy the deployed Worker URL into `config.js` as `MEDIA_WORKER_URL`.

### 4. Fill in config.js
```js
window.AGRABAN_CONFIG = {
  SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_WORKER_URL, MEDIA_PUBLIC_BASE_URL
};
```
**Must be `window.AGRABAN_CONFIG =`, not `const AGRABAN_CONFIG =`** — a top-level `const` never attaches to `window`, and several pages specifically check `window.AGRABAN_CONFIG` to decide whether to fetch live data.

### 5. Log in
Open `cms.html` and log in with the admin email/password from step 1.3.

## Using the CMS day-to-day

- **Home tab** — upload the looping background video (.mp4) and edit the tagline text shown under the site title.
- **Projects tab** — three sub-tabs, **each capped at 6 items**: 2D Illustrations, 3D Modelling (still image + optional `.glb`/`.gltf`), Animation Showreel (YouTube link, no file upload).
- **Events & Achievements tab** — Awards (title, description, year, optional link to a related exhibition) and Exhibitions & Competitions (title, description, image gallery).
- **Contact tab** — upload your Resume and/or CV (PDF) and set the download button's label; clicking that button on the live site downloads whichever of the two files are set. Also manage the row of link buttons (label + URL) — use `mailto:you@example.com` as the URL for an email button.
- **Trash tab** — replaced/removed media lands here first. **Restore** puts it back; **Delete Permanently** removes it from R2 for good.

Changes appear on the live site as soon as you save — `site-data.js` fetches fresh content from Supabase on every page load.

## Updating the profile photo
The portrait photo (used identically on both the Home and Contact pages) isn't CMS-managed — it's a hand-edited `<img>` tag in both `index.html` and `contact.html`. Update both files together if you change the photo, keeping the same file path in each.

## Media dimensions

| Media | Ratio | Size |
|---|---|---|
| Portrait photo | 1:1 (circle crop) | 500×500px |
| Background reel video | 16:9 | 1920×1080px, MP4, muted, short loop, compressed |
| Project gallery tiles | 4:5 | 1000×1250px |
| Events showcase images | 4:5 | 1000×1250px |
| 3D still renders | 4:5 | 1000×1250px |

## Notes
- Fonts load from Google Fonts via CDN — requires an internet connection to render correctly (fine for a live site).
- The 3D viewer uses Google's `<model-viewer>` web component, loaded via CDN in `projects.html`.
- Every public page loads the Supabase client via CDN and fetches live data on load — an internet connection is required for real content to appear (fallback placeholders show otherwise, rather than the page breaking).
- `cms.html` is not linked anywhere in the public site nav and is excluded from search indexing, but the actual security boundary is your Supabase login — not obscurity.
