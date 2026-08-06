# AgrabanArt — Portfolio Site

Personal digital portfolio for Mohamad Raziqaiman Bin Mohd Yazid (AgrabanArt).
Static HTML/CSS/JS site — no build tools required, hosted on GitHub Pages.

## Folder structure

```
portfolio-site/
├── index.html               Home — hero with looping background reel
├── projects.html            2D Illustrations / 3D Modelling / Animation Showreel (live data)
├── project-template.html    Dynamic detail page — reads ?id= and fetches from Supabase
├── events.html               Awards / Exhibitions & Competitions (live data)
├── contact.html              Links + resume download
├── style.css                 Shared design system (colors, type, layout)
├── script.js                 Shared behavior (nav, carousels, animations)
├── site-data.js               Fetches Supabase content into projects.html / events.html
├── config.js                  Supabase + Cloudflare connection details (fill this in)
├── cms.html                   Admin dashboard — add/edit/delete content here
├── cms.css                    Admin dashboard styles
├── cms.js                      Admin dashboard logic (auth, CRUD, uploads, trash)
├── supabase-schema.sql         Database schema — run once in Supabase's SQL editor
├── cloudflare-worker/
│   ├── media-worker.js          The Worker that brokers uploads/deletes to R2
│   └── wrangler.toml             Worker deploy config
├── resume.pdf                 Your resume/CV file (add this yourself)
└── media/
    ├── portrait.jpg            Profile photo (used on index + contact)
    └── showreel-bg.mp4          Looping background video (index hero)
```

**Important:** the `media/` folder must live in the same root folder as the
HTML files — all image/video paths in the code are relative to that root.
This `media/` folder is only for the two files above (portrait + background
video) that aren't managed by the CMS — everything else (project images,
3D models, exhibition photos) lives in your Cloudflare R2 bucket instead,
managed entirely through the CMS.

## Deploying to GitHub Pages

1. Create a repo on GitHub (or use an existing one).
2. Push/upload this whole folder to the repo root — keep the folder
   structure intact.
3. In the repo, go to **Settings → Pages**, set the source to your main
   branch (root folder).
4. Your site goes live at `https://your-username.github.io/repo-name/`.

## Setting up the CMS (one-time)

The CMS lets you add/edit/delete Projects, Awards, and Exhibitions from a
web dashboard instead of editing code. It's built on three pieces you need
to set up once: **Supabase** (login + database), a **Cloudflare Worker**
(a safe go-between), and **Cloudflare R2** (where files actually live).

### 1. Supabase (auth + database)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the entire contents of `supabase-schema.sql`, and run it.
3. Go to **Authentication → Users → Add user** and create yourself an admin login (email + password).
4. Copy that user's UID, then in the SQL Editor run:
   ```sql
   insert into admins (user_id) values ('paste-your-user-uid-here');
   ```
   This is what actually grants write access — without it, login works but every save is blocked.
5. Go to **Settings → API** and copy your **Project URL** and **anon public key** — you'll need both for `config.js`.

### 2. Cloudflare R2 (file storage)
1. In the Cloudflare dashboard, go to **R2 → Create bucket**, e.g. name it `agrabanart-media`.
2. Open the bucket → **Settings → Public Access** and enable it (or connect a custom domain to the bucket instead — either works, a custom domain just looks nicer).
3. Note the public base URL it gives you (e.g. `https://pub-xxxx.r2.dev` or your custom domain) — this goes in `config.js` as `MEDIA_PUBLIC_BASE_URL`.

### 3. Cloudflare Worker (the safe go-between)
Browsers can't write to R2 directly without exposing secret keys, so the CMS talks to a small Worker instead. Full deploy steps are commented at the top of `cloudflare-worker/media-worker.js`, summarized here:
1. `npm install -g wrangler`
2. Edit `cloudflare-worker/wrangler.toml` — set your bucket name.
3. From inside `cloudflare-worker/`, run:
   ```
   wrangler secret put SUPABASE_URL
   wrangler secret put ADMIN_EMAIL
   wrangler deploy
   ```
4. Copy the deployed Worker URL into `config.js` as `MEDIA_WORKER_URL`.

### 4. Fill in config.js
Open `config.js` and paste in the four values gathered above:
```js
SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_WORKER_URL, MEDIA_PUBLIC_BASE_URL
```
This one file is read by both `cms.html` and the main site pages — update it here once and everything picks it up.

### 5. Log in
Open `cms.html` in a browser and log in with the admin email/password you created in step 1.3.

## Using the CMS day-to-day

Once set up, `cms.html` is where you manage content — you shouldn't need to hand-edit `projects.html` or `events.html` again.

- **Projects tab** — three sub-tabs matching the site's sections:
  - *2D Illustrations* is capped at 6 (enforced both in the CMS and the database) — delete one to add another.
  - *3D Modelling* — upload a still image, and optionally a `.glb`/`.gltf` file for the interactive viewer.
  - *Animation Showreel* — paste a YouTube link; no file upload needed.
- **Events & Achievements tab** — *Awards* (title, description, year, and an optional dropdown linking to a related exhibition) and *Exhibitions & Competitions* (title, description, plus its own image gallery, added after you save the exhibition once).
- **Trash tab** — whenever you replace or delete media anywhere in the CMS, the old file lands here instead of vanishing immediately. **Restore** reattaches it to where it was; **Delete Permanently** removes it from R2 for good and can't be undone.

Changes appear on the live site as soon as you save — `site-data.js` fetches fresh content from Supabase every time someone loads `projects.html` or `events.html`.

## Updating index.html / contact.html content
The homepage and contact page aren't wired to the CMS — they're simple enough to hand-edit directly. Every placeholder there has an HTML comment above it explaining what to replace. Search for the word `COMMENT` in any file to jump straight to editable spots.

## Media dimensions
Same recommendations apply whether uploading through the CMS or hand-editing `media/`:

| Media | Ratio | Size |
|---|---|---|
| Portrait photo | 1:1 (circle crop) | 500×500px |
| Background reel video | 16:9 | 1920×1080px, MP4, muted, short loop |
| Project gallery tiles | 4:5 | 1000×1250px |
| Events showcase images | 4:5 | 1000×1250px |
| 3D still renders | 4:5 | 1000×1250px |

General tips:
- Export images ~2x display size for retina screens, but don't go overboard.
- Compress everything for web (JPG/WebP for images).
- Keep filenames lowercase, no spaces — the CMS auto-cleans filenames on upload, but it's good practice regardless.

## Notes
- Fonts (Bebas Neue, Inter, JetBrains Mono) load from Google Fonts via CDN — requires an internet connection to render correctly (fine for a live site).
- The 3D viewer uses Google's `<model-viewer>` web component, loaded via CDN in `projects.html`.
- `projects.html`, `events.html`, and `project-template.html` all load the Supabase client via CDN and fetch live data on page load — an internet connection is required for them to show real content (they'll just show "Nothing added yet" placeholders if `config.js` isn't filled in or the connection fails, rather than breaking).
- `cms.html` is not linked anywhere in the public site nav and is excluded from search indexing, but the actual security boundary is your Supabase login — not obscurity. Anyone loading the URL just sees a login screen.
