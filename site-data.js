// ==========================================================================
// AgrabanArt — live content loader
// ==========================================================================
// COMMENT: this file fetches data from Supabase and fills in the empty
// containers left in index.html, projects.html, events.html, and
// contact.html. It only runs the pieces relevant to whichever page it's
// loaded on (it checks whether each container exists before doing
// anything with it), so the same file works across all pages without
// errors.
//
// You should not normally need to edit this file — content changes happen
// through cms.html, which writes to the same Supabase tables this file
// reads from.
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Guard: if config.js hasn't been filled in yet, don't attempt to fetch —
  // just leave the fallback placeholders showing.
  if (!window.AGRABAN_CONFIG || AGRABAN_CONFIG.SUPABASE_URL.includes('your-project-ref')) {
    console.warn('AgrabanArt: config.js is still using placeholder values — skipping live data fetch.');
    return;
  }

  const client = window.supabase.createClient(AGRABAN_CONFIG.SUPABASE_URL, AGRABAN_CONFIG.SUPABASE_ANON_KEY);
  const mediaUrl = (key) => `${AGRABAN_CONFIG.MEDIA_PUBLIC_BASE_URL}/${key}`;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // HOME PAGE — background video + tagline
  // ------------------------------------------------------------------
  const heroVideo = document.getElementById('hero-bg-video');
  const heroTagline = document.getElementById('hero-tagline');

  if (heroVideo || heroTagline) {
    const { data, error } = await client.from('home_content').select('*').eq('id', 1).single();
    if (error) {
      console.error('AgrabanArt: failed to load home content', error);
    } else if (data) {
      if (heroVideo && data.video_key) {
        heroVideo.src = mediaUrl(data.video_key);
        heroVideo.style.display = 'block';
      }
      if (heroTagline && data.tagline) {
        heroTagline.textContent = data.tagline;
      }
    }
  }

  // ------------------------------------------------------------------
  // Builds one clickable project tile (used for both 2D and 3D galleries)
  // ------------------------------------------------------------------
  function buildProjectTile(project) {
    const a = document.createElement('a');
    a.className = 'tile-link';
    a.href = `project-template.html?id=${project.id}`;

    const mediaBox = document.createElement('div');
    const thumbSrc = project.thumbnail_key || project.image_key;
    if (thumbSrc) {
      const img = document.createElement('img');
      img.src = mediaUrl(thumbSrc);
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

        const modelData = items
          .filter((p) => p.model_key)
          .map((p) => ({ title: p.title, src: mediaUrl(p.model_key) }));
        window.AgrabanCarousels?.updateModels(modelData);
      }

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

          block.innerHTML = `
            <h3>${escapeHtml(ex.title)}</h3>
            <p class="showcase-desc">${escapeHtml(ex.description)}</p>
            <div class="gallery-grid" id="gallery-${ex.id}"></div>
          `;
          exhibitionsList.appendChild(block);

          const grid = block.querySelector(`#gallery-${ex.id}`);
          if (exImages.length) {
            exImages.forEach((img) => {
              const tile = document.createElement('button');
              tile.className = 'tile-link';
              tile.style.cssText = 'border-width:1px; cursor:pointer; padding:0;';
              tile.innerHTML = `<img src="${mediaUrl(img.thumbnail_key || img.image_key)}" alt="${escapeHtml(ex.title)}">`;
              tile.addEventListener('click', () => window.AgrabanLightbox?.open(mediaUrl(img.image_key), ex.title));
              grid.appendChild(tile);
            });
          } else {
            grid.innerHTML = '<p style="color: var(--muted); font-family: var(--font-mono); font-size: 0.8rem;">No images uploaded yet.</p>';
          }

          window.AgrabanReveal?.observe(block);
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // ABOUT ME PAGE — background/education/soft-skills text + technical
  // skills marquee
  // ------------------------------------------------------------------
  const aboutBackground = document.getElementById('about-background');
  const aboutEducation = document.getElementById('about-education');
  const aboutSoftSkills = document.getElementById('about-soft-skills');
  const skillsTrack = document.getElementById('skills-marquee-track');

  if (aboutBackground || aboutEducation || aboutSoftSkills || skillsTrack) {
    const [{ data: about, error: aboutErr }, { data: skills, error: skillsErr }] = await Promise.all([
      client.from('about_content').select('*').eq('id', 1).single(),
      client.from('technical_skills').select('*').order('sort_order', { ascending: true }),
    ]);

    if (aboutErr) console.error('AgrabanArt: failed to load about content', aboutErr);
    if (skillsErr) console.error('AgrabanArt: failed to load technical skills', skillsErr);

    if (about) {
      if (aboutBackground && about.background) aboutBackground.textContent = about.background;
      if (aboutEducation && about.education) aboutEducation.textContent = about.education;
      if (aboutSoftSkills && about.soft_skills) aboutSoftSkills.textContent = about.soft_skills;
    }

    if (skillsTrack && skills && skills.length) {
      const buildSkillItem = (skill) => {
        const item = document.createElement('div');
        item.className = 'skill-item';
        const iconHtml = skill.icon_key
          ? `<div class="skill-icon"><img src="${mediaUrl(skill.icon_key)}" alt="${escapeHtml(skill.name)}"></div>`
          : `<div class="skill-icon"></div>`;
        item.innerHTML = `${iconHtml}<p class="skill-name">${escapeHtml(skill.name)}</p>`;
        return item;
      };

      skillsTrack.innerHTML = '';
      // COMMENT: with only a few skills added, simply duplicating the list
      // once left a visible gap on wide screens — there wasn't enough
      // content to fill the row before the loop restarted. This repeats
      // the skill set enough times to comfortably cover very wide
      // monitors, THEN duplicates that whole stretch once more so the
      // translateX(-50%) loop in the CSS animation stays seamless
      // regardless of how many skills exist.
      const estimatedItemWidth = 150; // icon + gap, roughly
      const targetUnitWidth = 3200; // comfortably covers ultra-wide screens
      const repeatCount = Math.max(1, Math.ceil(targetUnitWidth / (skills.length * estimatedItemWidth)));

      for (let copy = 0; copy < repeatCount * 2; copy++) {
        skills.forEach((s) => skillsTrack.appendChild(buildSkillItem(s)));
      }
    }
  }

  // ------------------------------------------------------------------
  // COMMISSION PAGE — simple scrolling image list
  // ------------------------------------------------------------------
  const commissionGallery = document.getElementById('commission-gallery');

  if (commissionGallery) {
    const { data: images, error } = await client
      .from('commission_images')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('AgrabanArt: failed to load commission images', error);
    } else if (images && images.length) {
      commissionGallery.innerHTML = '';
      images.forEach((img) => {
        const item = document.createElement('div');
        item.className = 'commission-item';
        const captionHtml = img.caption ? `<p class="commission-caption">${escapeHtml(img.caption)}</p>` : '';
        item.innerHTML = `<img src="${mediaUrl(img.image_key)}" alt="${escapeHtml(img.caption || 'Commission work')}">${captionHtml}`;
        commissionGallery.appendChild(item);
        window.AgrabanReveal?.observe(item);
      });
    }
  }

  // ------------------------------------------------------------------
  // CONTACT PAGE — link buttons + resume/CV download buttons
  // ------------------------------------------------------------------
  const contactLinksGrid = document.getElementById('contact-links-grid');
  const resumeButtons = document.getElementById('resume-buttons');
  const socialsDivider = document.getElementById('contact-socials-divider');

  if (contactLinksGrid || resumeButtons) {
    const [{ data: links, error: linksErr }, { data: resumeDocs, error: resumeErr }] = await Promise.all([
      client.from('contact_links').select('*').order('sort_order', { ascending: true }),
      client.from('resume_documents').select('*').order('sort_order', { ascending: true }),
    ]);

    if (linksErr) console.error('AgrabanArt: failed to load contact links', linksErr);
    if (resumeErr) console.error('AgrabanArt: failed to load resume documents', resumeErr);

    let hasLinks = false;
    if (contactLinksGrid && links && links.length) {
      hasLinks = true;
      contactLinksGrid.innerHTML = '';
      links.forEach((link) => {
        const a = document.createElement('a');
        a.href = link.url;
        if (!link.url.startsWith('mailto:')) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        a.innerHTML = `${escapeHtml(link.label)} <span>&rarr;</span>`;
        contactLinksGrid.appendChild(a);
        window.AgrabanReveal?.observe(a);
      });
    }

    let hasResumeDocs = false;
    if (resumeButtons && resumeDocs && resumeDocs.length) {
      hasResumeDocs = true;
      resumeDocs.forEach((doc) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = doc.label;
        btn.addEventListener('click', () => triggerDownload(mediaUrl(doc.file_key), `${doc.label}.pdf`));
        resumeButtons.appendChild(btn);
        window.AgrabanReveal?.observe(btn);
      });
    }

    // Only show the "My Socials" divider when there's something on both
    // sides of it to actually separate.
    if (socialsDivider && hasResumeDocs && hasLinks) {
      socialsDivider.style.display = 'block';
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
});
