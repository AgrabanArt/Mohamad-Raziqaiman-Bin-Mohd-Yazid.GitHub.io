# AgrabanArt — Portfolio Site

Personal digital portfolio for Mohamad Raziqaiman Bin Mohd Yazid (AgrabanArt).
Static HTML/CSS/JS site — no build tools required, hosted on GitHub Pages.

## Folder structure

```
portfolio-site/
├── index.html              Home — hero with looping background reel
├── projects.html           2D Illustrations / 3D Modelling / Animation Showreel
├── project-template.html   Duplicate this per project for detail pages
├── events.html              Awards / Exhibitions & Competitions
├── contact.html             Links + resume download
├── style.css                Shared design system (colors, type, layout)
├── script.js                Shared behavior (nav, carousels, animations)
├── resume.pdf                Your resume/CV file (add this yourself)
└── media/
    ├── portrait.jpg          Profile photo (used on index + contact)
    ├── showreel-bg.mp4       Looping background video (index hero)
    ├── projects/              Images/video for individual project pieces
    ├── models/                 .glb / .gltf files for the 3D carousel
    └── events/                 Images for the Exhibitions & Competitions showcases
```

**Important:** the `media/` folder must live in the same root folder as the
HTML files — all image/video paths in the code are relative to that root.

## Deploying to GitHub Pages

1. Create a repo on GitHub (or use an existing one).
2. Push/upload this whole folder to the repo root — keep the folder
   structure intact.
3. In the repo, go to **Settings → Pages**, set the source to your main
   branch (root folder).
4. Your site goes live at `https://your-username.github.io/repo-name/`.

## Updating content

Every placeholder in the code has an HTML comment directly above it
explaining what to replace and how. Search for the word `COMMENT` in any
file to jump straight to editable spots.

### Adding real media
Recommended dimensions:
| Media | Ratio | Size |
|---|---|---|
| Portrait photo | 1:1 (circle crop) | 500×500px |
| Background reel video | 16:9 | 1920×1080px, MP4, muted, short loop |
| Project gallery tiles | 4:5 | 1000×1250px |
| Animation showreel video | 16:9 | 1920×1080px, MP4 (H.264) |
| Project detail page media | 16:9 | 1600×900px (if a still image) |
| Events showcase images | 4:5 | 1000×1250px |

General tips:
- Export images ~2x display size for retina screens, but don't go overboard.
- Compress everything for web (JPG/WebP for images, H.264 MP4 for video).
- Keep filenames lowercase, no spaces — use hyphens (`2d-piece-01.jpg`).

### Adding a new project
1. Duplicate `project-template.html`, rename it, fill in its content.
2. In `projects.html`, point the relevant thumbnail's `href` at the new file.

### 3D Modelling / Animation Showreel carousels
Edit the `models` and `videos` arrays near the top of `script.js`
(search for `MODEL CAROUSEL DATA` / `VIDEO CAROUSEL DATA`). Each entry is
`{ title, src }` — leave `src: ''` to keep showing the placeholder.

### Adding an award / showcase pair (events.html)
1. Copy a whole `.achievement-item` block in the Awards section, give its
   `.achievement-link` a new `href="#showcase-N"`.
2. Copy a whole `.showcase-block` in the Exhibitions & Competitions section,
   give it a matching `id="showcase-N"`.
Delete both halves to remove one instead.

## Notes
- Fonts (Bebas Neue, Inter, JetBrains Mono) load from Google Fonts via CDN —
  requires an internet connection to render correctly (fine for a live site).
- The 3D viewer uses Google's `<model-viewer>` web component, loaded via CDN
  in `projects.html`.
