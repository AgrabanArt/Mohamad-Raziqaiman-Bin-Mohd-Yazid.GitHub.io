// ==========================================================================
// AgrabanArt — live content loader
// ==========================================================================
// COMMENT: this file fetches data from Supabase and fills in the empty
// containers left in projects.html and events.html. It only runs the
// pieces relevant to whichever page it's loaded on (it checks whether
// each container exists before doing anything with it), so the same file
// works across both pages without errors.
//
// You should not normally need to edit this file — content changes happen
// through cms.html, which writes to the same Supabase tables this file
// reads from.
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Guard: if config.js hasn't been filled in yet, don't attempt to fetch —
  // just leave the "Nothing added yet" placeholders showing.
  if (!window.AGRABAN_CONFIG || AGRABAN_CONFIG.SUPABASE_URL.includes('your-project-ref')) {
    console.warn('AgrabanArt: config.js is still using placeholder values — skipping live data fetch.');
    return;
  }

  const client = window.supabase.createClient(AGRABAN_CONFIG.SUPABASE_URL, AGRABAN_CONFIG.SUPABASE_ANON_KEY);
  const mediaUrl = (key) => `${AGRABAN_CONFIG.MEDIA_PUBLIC_BASE_URL}/${key}`;

  // ------------------------------------------------------------------
  // Builds one clickable project tile (used for both 2D and 3D galleries)
  // ------------------------------------------------------------------
  function buildProjectTile(project) {
    const a = document.createElement('a');
    a.className = 'tile-link';
    a.href = `project-template.html?id=${project.id}`;

    const mediaBox = document.createElement('div');
    if (project.image_key) {
      const img = document.createElement('img');
      img.src = mediaUrl(project.image_key);
      img.alt = project.title;
      mediaBox.appendChild(img);
    } else {
      mediaBox.className = 'tile-placeholder-label';
      mediaBox.textContent = 'No image uploaded yet';
    }

    const caption = document.createElement('div');
    caption.className = 'tile-caption';
    caption.innerHTML = `<p class="tile-title">${escapeHtml(project.title)}</p><p>${escapeHtml(project.description)}</p>`;

    a.appendChild(mediaBox);
    a.appendChild(caption);
    return a;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // PROJECTS PAGE
  // ------------------------------------------------------------------
  const gallery2d = document.getElementById('gallery-2d');
  const gallery3d = document.getElementById('gallery-3d');

  if (gallery2d || gallery3d) {
    const { data: projects, error } = await client
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('AgrabanArt: failed to load projects', error);
    } else {
      const by = (cat) => (projects || []).filter((p) => p.category === cat);

      if (gallery2d) {
        const items = by('2d');
        if (items.length) {
          gallery2d.innerHTML = '';
          items.forEach((p) => {
            const tile = buildProjectTile(p);
            gallery2d.appendChild(tile);
            window.AgrabanReveal?.observe(tile);
          });
        }
      }

      if (gallery3d) {
        const items = by('3d');
        if (items.length) {
          gallery3d.innerHTML = '';
          items.forEach((p) => {
            const tile = buildProjectTile(p);
            gallery3d.appendChild(tile);
            window.AgrabanReveal?.observe(tile);
          });
        }

        // Feed the same 3D items into the interactive model carousel —
        // only entries with a model_key actually show a model, others
        // fall back to the carousel's own placeholder text per-slide.
        const modelData = items
          .filter((p) => p.model_key)
          .map((p) => ({ title: p.title, src: mediaUrl(p.model_key) }));
        window.AgrabanCarousels?.updateModels(modelData);
      }

      // Animation showreel carousel — pulled from category 'animation',
      // each using a YouTube ID rather than an uploaded file.
      const animationItems = by('animation')
        .filter((p) => p.youtube_id)
        .map((p) => ({ title: p.title, type: 'youtube', id: p.youtube_id }));
      window.AgrabanCarousels?.updateVideos(animationItems);
    }
  }

  // ------------------------------------------------------------------
  // EVENTS & ACHIEVEMENTS PAGE
  // ------------------------------------------------------------------
  const awardsList = document.getElementById('awards-list');
  const exhibitionsList = document.getElementById('exhibitions-list');

  if (awardsList || exhibitionsList) {
    const [{ data: awards, error: awardsErr }, { data: exhibitions, error: exErr }, { data: images, error: imgErr }] = await Promise.all([
      client.from('awards').select('*').order('sort_order', { ascending: true }),
      client.from('exhibitions').select('*').order('sort_order', { ascending: true }),
      client.from('exhibition_images').select('*').order('sort_order', { ascending: true }),
    ]);

    if (awardsErr || exErr || imgErr) {
      console.error('AgrabanArt: failed to load events/achievements', awardsErr || exErr || imgErr);
    } else {
      if (awardsList && awards && awards.length) {
        awardsList.innerHTML = '';
        awards.forEach((award) => {
          const item = document.createElement('div');
          item.className = 'achievement-item';
          const linkHtml = award.linked_exhibition_id
            ? `<a href="#showcase-${award.linked_exhibition_id}" class="achievement-link">View related showcase &rarr;</a>`
            : '';
          item.innerHTML = `
            <div>
              <h3>${escapeHtml(award.title)}</h3>
              <p>${escapeHtml(award.description)}</p>
              ${linkHtml}
            </div>
            <span class="achievement-date">${escapeHtml(award.year)}</span>
          `;
          awardsList.appendChild(item);
          window.AgrabanReveal?.observe(item);
        });
      }

      if (exhibitionsList && exhibitions && exhibitions.length) {
        exhibitionsList.innerHTML = '';
        exhibitions.forEach((ex) => {
          const block = document.createElement('div');
          block.className = 'showcase-block';
          block.id = `showcase-${ex.id}`;

          const exImages = (images || []).filter((img) => img.exhibition_id === ex.id);
          const galleryHtml = exImages.length
            ? exImages.map((img) => `<div class="tile-link"><img src="${mediaUrl(img.image_key)}" alt="${escapeHtml(ex.title)}"></div>`).join('')
            : '<p style="color: var(--muted); font-family: var(--font-mono); font-size: 0.8rem;">No images uploaded yet.</p>';

          block.innerHTML = `
            <h3>${escapeHtml(ex.title)}</h3>
            <p class="showcase-desc">${escapeHtml(ex.description)}</p>
            <div class="gallery-grid">${galleryHtml}</div>
          `;
          exhibitionsList.appendChild(block);
          window.AgrabanReveal?.observe(block);
        });
      }
    }
  }
});
