// ==========================================================================
// AgrabanArt CMS — dashboard logic
// ==========================================================================
// COMMENT: this file is organized into sections — Auth, Navigation, Upload
// helpers, Trash helpers, then one section per content type (Projects,
// Awards, Exhibitions), and finally the Trash panel itself. Search for the
// "====" banners to jump between them.
// ==========================================================================

const client = window.supabase.createClient(AGRABAN_CONFIG.SUPABASE_URL, AGRABAN_CONFIG.SUPABASE_ANON_KEY);
const mediaUrl = (key) => `${AGRABAN_CONFIG.MEDIA_PUBLIC_BASE_URL}/${key}`;

// ==========================================================================
// AUTH
// ==========================================================================

const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');

async function checkSession() {
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    initDashboard();
  } else {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    // COMMENT: this also fires if your email logged in fine but isn't in
    // the `admins` table yet — see supabase-schema.sql step 5. Supabase
    // itself doesn't distinguish that case from a wrong password, so if
    // login "succeeds" but every save fails with a permissions error,
    // check that table.
    errorEl.textContent = error.message;
    return;
  }
  checkSession();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await client.auth.signOut();
  checkSession();
});

checkSession();

// ==========================================================================
// NAVIGATION — sidebar panels + sub-tabs
// ==========================================================================

let dashboardInitialized = false;

function initDashboard() {
  if (dashboardInitialized) return; // avoid double-binding listeners on repeat logins
  dashboardInitialized = true;

  document.querySelectorAll('.cms-nav-btn[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cms-nav-btn[data-panel]').forEach((b) => b.classList.remove('is-active'));
      document.querySelectorAll('.cms-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById(btn.dataset.panel).classList.add('is-active');
    });
  });

  document.querySelectorAll('.cms-subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.cms-panel');
      parent.querySelectorAll('.cms-subtab-btn').forEach((b) => b.classList.remove('is-active'));
      parent.querySelectorAll('.cms-subpanel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById(btn.dataset.sub).classList.add('is-active');
    });
  });

  refreshProjects('2d');
  refreshProjects('3d');
  refreshProjects('animation');
  refreshAwards();
  refreshExhibitions();
  refreshTrash();
  wireProjectForms();
  wireAwardForm();
  wireExhibitionForm();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ==========================================================================
// UPLOAD / DELETE helpers — talk to the Cloudflare Worker, never to R2
// directly (see cloudflare-worker/media-worker.js for why)
// ==========================================================================

async function uploadFile(file, key) {
  const { data: { session } } = await client.auth.getSession();
  const res = await fetch(`${AGRABAN_CONFIG.MEDIA_WORKER_URL}?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) throw new Error('Upload failed — check that config.js and the Worker are set up correctly.');
  return key;
}

async function deleteFileFromR2(key) {
  const { data: { session } } = await client.auth.getSession();
  await fetch(`${AGRABAN_CONFIG.MEDIA_WORKER_URL}?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

function makeKey(folder, file) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  return `${folder}/${Date.now()}-${safeName}`;
}

// ==========================================================================
// TRASH helpers — logs an old file to media_trash instead of deleting it
// right away. See the Trash panel section near the bottom for restore /
// permanent-delete logic.
// ==========================================================================

async function trashMedia({ storageKey, originalFilename, sourceTable, sourceId, sourceColumn }) {
  if (!storageKey) return;
  await client.from('media_trash').insert({
    storage_key: storageKey,
    original_filename: originalFilename || storageKey,
    source_table: sourceTable,
    source_id: sourceId,
    source_column: sourceColumn,
  });
}

// ==========================================================================
// PROJECTS (2D / 3D / Animation) — shared list rendering + per-category forms
// ==========================================================================

async function refreshProjects(category) {
  const { data, error } = await client.from('projects').select('*').eq('category', category).order('sort_order');
  if (error) {
    console.error(error);
    return;
  }
  const listId = category === '2d' ? 'list-2d' : category === '3d' ? 'list-3d' : 'list-anim';
  const container = document.getElementById(listId);
  container.innerHTML = '';

  if (!data.length) {
    container.innerHTML = '<p class="cms-empty-note">Nothing added yet.</p>';
  } else {
    data.forEach((project) => {
      const row = document.createElement('div');
      row.className = 'cms-item-card';
      const thumbHtml = project.image_key
        ? `<img class="cms-item-thumb" src="${mediaUrl(project.image_key)}" alt="">`
        : `<div class="cms-item-thumb"></div>`;
      row.innerHTML = `
        ${thumbHtml}
        <div class="cms-item-info">
          <h4>${escapeHtml(project.title)}</h4>
          <p>${escapeHtml(project.description)}</p>
        </div>
        <div class="cms-item-actions">
          <button class="cms-btn edit-btn">Edit</button>
          <button class="cms-btn danger delete-btn">Delete</button>
        </div>
      `;
      row.querySelector('.edit-btn').addEventListener('click', () => openProjectForm(category, project));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteProject(category, project));
      container.appendChild(row);
    });
  }

  if (category === '2d') {
    const note = document.getElementById('limit-2d-note');
    note.textContent = `${data.length} of 6 used`;
    document.getElementById('add-2d-btn').disabled = data.length >= 6;
    document.getElementById('add-2d-btn').style.opacity = data.length >= 6 ? 0.4 : 1;
    if (data.length >= 6) {
      note.textContent += ' — maximum reached. Delete one to add another.';
    }
  }
}

function openProjectForm(category, project) {
  const suffix = category === '2d' ? '2d' : category === '3d' ? '3d' : 'anim';
  document.getElementById(`form-${suffix}`).hidden = false;
  document.getElementById(`form-${suffix}-title`).textContent = project ? `Edit ${project.title}` : 'Add New';
  document.getElementById(`form-${suffix}-id`).value = project ? project.id : '';
  document.getElementById(`form-${suffix}-name`).value = project ? project.title : '';
  document.getElementById(`form-${suffix}-desc`).value = project ? project.description : '';
  document.getElementById(`status-${suffix}`).textContent = '';
  if (category === 'animation') {
    document.getElementById('form-anim-link').value = project && project.youtube_id ? `https://www.youtube.com/watch?v=${project.youtube_id}` : '';
  }
  // clear any previously-chosen files
  const fileInput = document.getElementById(`form-${suffix}-file`);
  if (fileInput) fileInput.value = '';
  if (category === '3d') document.getElementById('form-3d-model').value = '';
  document.getElementById(`form-${suffix}`)._editingProject = project || null;
}

function closeProjectForm(suffix) {
  document.getElementById(`form-${suffix}`).hidden = true;
}

function extractYouTubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

async function deleteProject(category, project) {
  if (!confirm(`Delete "${project.title}"? Its media will be moved to Trash.`)) return;
  if (project.image_key) {
    await trashMedia({ storageKey: project.image_key, originalFilename: project.title, sourceTable: 'projects', sourceId: project.id, sourceColumn: 'image_key' });
  }
  if (project.model_key) {
    await trashMedia({ storageKey: project.model_key, originalFilename: project.title, sourceTable: 'projects', sourceId: project.id, sourceColumn: 'model_key' });
  }
  await client.from('projects').delete().eq('id', project.id);
  refreshProjects(category);
  refreshTrash();
}

function wireProjectForms() {
  document.getElementById('add-2d-btn').addEventListener('click', () => openProjectForm('2d', null));
  document.getElementById('add-3d-btn').addEventListener('click', () => openProjectForm('3d', null));
  document.getElementById('add-anim-btn').addEventListener('click', () => openProjectForm('animation', null));

  document.getElementById('cancel-2d-btn').addEventListener('click', () => closeProjectForm('2d'));
  document.getElementById('cancel-3d-btn').addEventListener('click', () => closeProjectForm('3d'));
  document.getElementById('cancel-anim-btn').addEventListener('click', () => closeProjectForm('anim'));

  document.getElementById('save-2d-btn').addEventListener('click', () => saveProjectForm('2d'));
  document.getElementById('save-3d-btn').addEventListener('click', () => saveProjectForm('3d'));
  document.getElementById('save-anim-btn').addEventListener('click', () => saveProjectForm('animation'));
}

async function saveProjectForm(category) {
  const suffix = category === '2d' ? '2d' : category === '3d' ? '3d' : 'anim';
  const statusEl = document.getElementById(`status-${suffix}`);
  statusEl.className = 'cms-status';
  statusEl.textContent = 'Saving…';

  try {
    const id = document.getElementById(`form-${suffix}-id`).value || null;
    const existing = document.getElementById(`form-${suffix}`)._editingProject;
    const title = document.getElementById(`form-${suffix}-name`).value.trim() || 'Untitled Project';
    const description = document.getElementById(`form-${suffix}-desc`).value.trim();

    const payload = { category, title, description };

    if (category === 'animation') {
      const link = document.getElementById('form-anim-link').value.trim();
      const ytId = extractYouTubeId(link);
      if (link && !ytId) throw new Error('Could not read a video ID from that YouTube link.');
      payload.youtube_id = ytId || null;
    } else {
      const fileInput = document.getElementById(`form-${suffix}-file`);
      if (fileInput.files[0]) {
        const key = makeKey(`projects/${category}`, fileInput.files[0]);
        await uploadFile(fileInput.files[0], key);
        // old image gets trashed, not deleted immediately
        if (existing && existing.image_key) {
          await trashMedia({ storageKey: existing.image_key, originalFilename: title, sourceTable: 'projects', sourceId: id, sourceColumn: 'image_key' });
        }
        payload.image_key = key;
      }
      if (category === '3d') {
        const modelInput = document.getElementById('form-3d-model');
        if (modelInput.files[0]) {
          const key = makeKey('models', modelInput.files[0]);
          await uploadFile(modelInput.files[0], key);
          if (existing && existing.model_key) {
            await trashMedia({ storageKey: existing.model_key, originalFilename: title, sourceTable: 'projects', sourceId: id, sourceColumn: 'model_key' });
          }
          payload.model_key = key;
        }
      }
    }

    if (id) {
      const { error } = await client.from('projects').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      // COMMENT: the 6-item 2D cap is also enforced in the database
      // (see supabase-schema.sql) as a safety net, but we check here too
      // so the CMS gives an immediate, friendly error instead of a raw
      // database exception.
      if (category === '2d') {
        const { count } = await client.from('projects').select('*', { count: 'exact', head: true }).eq('category', '2d');
        if (count >= 6) throw new Error('Maximum of 6 2D Illustrations reached.');
      }
      const { error } = await client.from('projects').insert(payload);
      if (error) throw error;
    }

    statusEl.textContent = 'Saved.';
    statusEl.className = 'cms-status success';
    refreshProjects(category);
    refreshTrash();
    setTimeout(() => closeProjectForm(suffix), 600);
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'cms-status error';
  }
}

// ==========================================================================
// AWARDS
// ==========================================================================

async function refreshAwards() {
  const { data: awards } = await client.from('awards').select('*').order('sort_order');
  const { data: exhibitions } = await client.from('exhibitions').select('*').order('sort_order');

  // keep the "related exhibition" dropdown in sync
  const select = document.getElementById('form-award-exhibition');
  const currentValue = select.value;
  select.innerHTML = '<option value="">None</option>';
  (exhibitions || []).forEach((ex) => {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.title;
    select.appendChild(opt);
  });
  select.value = currentValue;

  const container = document.getElementById('list-awards');
  container.innerHTML = '';
  if (!awards || !awards.length) {
    container.innerHTML = '<p class="cms-empty-note">Nothing added yet.</p>';
    return;
  }
  awards.forEach((award) => {
    const row = document.createElement('div');
    row.className = 'cms-item-card';
    row.innerHTML = `
      <div class="cms-item-thumb" style="display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.7rem;color:var(--gold);">${escapeHtml(award.year)}</div>
      <div class="cms-item-info">
        <h4>${escapeHtml(award.title)}</h4>
        <p>${escapeHtml(award.description)}</p>
      </div>
      <div class="cms-item-actions">
        <button class="cms-btn edit-btn">Edit</button>
        <button class="cms-btn danger delete-btn">Delete</button>
      </div>
    `;
    row.querySelector('.edit-btn').addEventListener('click', () => openAwardForm(award));
    row.querySelector('.delete-btn').addEventListener('click', () => deleteAward(award));
    container.appendChild(row);
  });
}

function openAwardForm(award) {
  document.getElementById('form-award').hidden = false;
  document.getElementById('form-award-title').textContent = award ? `Edit ${award.title}` : 'Add Award';
  document.getElementById('form-award-id').value = award ? award.id : '';
  document.getElementById('form-award-name').value = award ? award.title : '';
  document.getElementById('form-award-desc').value = award ? award.description : '';
  document.getElementById('form-award-year').value = award ? award.year : '';
  document.getElementById('form-award-exhibition').value = award && award.linked_exhibition_id ? award.linked_exhibition_id : '';
  document.getElementById('status-award').textContent = '';
}

async function deleteAward(award) {
  if (!confirm(`Delete "${award.title}"?`)) return;
  await client.from('awards').delete().eq('id', award.id);
  refreshAwards();
}

function wireAwardForm() {
  document.getElementById('add-award-btn').addEventListener('click', () => openAwardForm(null));
  document.getElementById('cancel-award-btn').addEventListener('click', () => { document.getElementById('form-award').hidden = true; });
  document.getElementById('save-award-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status-award');
    statusEl.className = 'cms-status';
    statusEl.textContent = 'Saving…';
    try {
      const id = document.getElementById('form-award-id').value || null;
      const payload = {
        title: document.getElementById('form-award-name').value.trim() || 'Untitled Award',
        description: document.getElementById('form-award-desc').value.trim(),
        year: document.getElementById('form-award-year').value.trim(),
        linked_exhibition_id: document.getElementById('form-award-exhibition').value || null,
      };
      const { error } = id
        ? await client.from('awards').update(payload).eq('id', id)
        : await client.from('awards').insert(payload);
      if (error) throw error;
      statusEl.textContent = 'Saved.';
      statusEl.className = 'cms-status success';
      refreshAwards();
      setTimeout(() => { document.getElementById('form-award').hidden = true; }, 600);
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'cms-status error';
    }
  });
}

// ==========================================================================
// EXHIBITIONS & COMPETITIONS — plus their image sub-management
// ==========================================================================

let currentExhibitionId = null;

async function refreshExhibitions() {
  const { data, error } = await client.from('exhibitions').select('*').order('sort_order');
  if (error) {
    console.error(error);
    return;
  }
  const container = document.getElementById('list-exhibitions');
  container.innerHTML = '';
  if (!data.length) {
    container.innerHTML = '<p class="cms-empty-note">Nothing added yet.</p>';
    return;
  }
  data.forEach((ex) => {
    const row = document.createElement('div');
    row.className = 'cms-item-card';
    row.innerHTML = `
      <div class="cms-item-info">
        <h4>${escapeHtml(ex.title)}</h4>
        <p>${escapeHtml(ex.description)}</p>
      </div>
      <div class="cms-item-actions">
        <button class="cms-btn edit-btn">Edit</button>
        <button class="cms-btn danger delete-btn">Delete</button>
      </div>
    `;
    row.querySelector('.edit-btn').addEventListener('click', () => openExhibitionForm(ex));
    row.querySelector('.delete-btn').addEventListener('click', () => deleteExhibition(ex));
    container.appendChild(row);
  });
}

function openExhibitionForm(exhibition) {
  currentExhibitionId = exhibition ? exhibition.id : null;
  document.getElementById('form-exhibition').hidden = false;
  document.getElementById('form-exhibition-title').textContent = exhibition ? `Edit ${exhibition.title}` : 'Add Exhibition / Competition';
  document.getElementById('form-exhibition-id').value = exhibition ? exhibition.id : '';
  document.getElementById('form-exhibition-name').value = exhibition ? exhibition.title : '';
  document.getElementById('form-exhibition-desc').value = exhibition ? exhibition.description : '';
  document.getElementById('status-exhibition').textContent = '';

  const imagesSection = document.getElementById('exhibition-images-section');
  if (exhibition) {
    imagesSection.hidden = false;
    refreshExhibitionImages(exhibition.id);
  } else {
    imagesSection.hidden = true; // save the exhibition first, then images can be added
  }
}

async function deleteExhibition(exhibition) {
  if (!confirm(`Delete "${exhibition.title}"? Its images will be moved to Trash.`)) return;
  const { data: images } = await client.from('exhibition_images').select('*').eq('exhibition_id', exhibition.id);
  for (const img of images || []) {
    await trashMedia({ storageKey: img.image_key, originalFilename: exhibition.title, sourceTable: 'exhibition_images', sourceId: img.id, sourceColumn: 'image_key' });
  }
  await client.from('exhibitions').delete().eq('id', exhibition.id); // cascades exhibition_images rows
  refreshExhibitions();
  refreshAwards(); // dropdown + any "linked" awards may reference this
  refreshTrash();
}

async function refreshExhibitionImages(exhibitionId) {
  const { data } = await client.from('exhibition_images').select('*').eq('exhibition_id', exhibitionId).order('sort_order');
  const list = document.getElementById('exhibition-images-list');
  list.innerHTML = '';
  if (!data || !data.length) {
    list.innerHTML = '<p class="cms-empty-note">No images yet.</p>';
    return;
  }
  data.forEach((img) => {
    const row = document.createElement('div');
    row.className = 'cms-item-card';
    row.innerHTML = `
      <img class="cms-item-thumb" src="${mediaUrl(img.image_key)}" alt="">
      <div class="cms-item-info"><p>${escapeHtml(img.image_key)}</p></div>
      <div class="cms-item-actions"><button class="cms-btn danger delete-btn">Delete</button></div>
    `;
    row.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('Move this image to Trash?')) return;
      await trashMedia({ storageKey: img.image_key, originalFilename: img.image_key, sourceTable: 'exhibition_images', sourceId: img.id, sourceColumn: 'image_key' });
      await client.from('exhibition_images').delete().eq('id', img.id);
      refreshExhibitionImages(exhibitionId);
      refreshTrash();
    });
    list.appendChild(row);
  });
}

function wireExhibitionForm() {
  document.getElementById('add-exhibition-btn').addEventListener('click', () => openExhibitionForm(null));
  document.getElementById('cancel-exhibition-btn').addEventListener('click', () => { document.getElementById('form-exhibition').hidden = true; });

  document.getElementById('save-exhibition-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status-exhibition');
    statusEl.className = 'cms-status';
    statusEl.textContent = 'Saving…';
    try {
      const id = document.getElementById('form-exhibition-id').value || null;
      const payload = {
        title: document.getElementById('form-exhibition-name').value.trim() || 'Untitled Exhibition',
        description: document.getElementById('form-exhibition-desc').value.trim(),
      };
      if (id) {
        const { error } = await client.from('exhibitions').update(payload).eq('id', id);
        if (error) throw error;
        currentExhibitionId = id;
      } else {
        const { data, error } = await client.from('exhibitions').insert(payload).select().single();
        if (error) throw error;
        currentExhibitionId = data.id;
        document.getElementById('form-exhibition-id').value = data.id;
      }
      statusEl.textContent = 'Saved. You can now add showcase images below.';
      statusEl.className = 'cms-status success';
      document.getElementById('exhibition-images-section').hidden = false;
      refreshExhibitionImages(currentExhibitionId);
      refreshExhibitions();
      refreshAwards();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'cms-status error';
    }
  });

  document.getElementById('add-exhibition-image-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('exhibition-image-file');
    if (!fileInput.files[0] || !currentExhibitionId) return;
    const key = makeKey(`events/${currentExhibitionId}`, fileInput.files[0]);
    await uploadFile(fileInput.files[0], key);
    await client.from('exhibition_images').insert({ exhibition_id: currentExhibitionId, image_key: key });
    fileInput.value = '';
    refreshExhibitionImages(currentExhibitionId);
  });
}

// ==========================================================================
// TRASH — restore or permanently delete previously-replaced/removed media
// ==========================================================================

async function refreshTrash() {
  const { data, error } = await client
    .from('media_trash')
    .select('*')
    .eq('permanently_deleted', false)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById('list-trash');
  container.innerHTML = '';
  if (!data.length) {
    container.innerHTML = '<p class="cms-empty-note">Trash is empty.</p>';
    return;
  }

  data.forEach((item) => {
    const isImage = /\.(jpe?g|png|webp|gif)$/i.test(item.storage_key);
    const row = document.createElement('div');
    row.className = 'cms-item-card';
    const thumbHtml = isImage
      ? `<img class="cms-item-thumb" src="${mediaUrl(item.storage_key)}" alt="">`
      : `<div class="cms-item-thumb"></div>`;
    row.innerHTML = `
      ${thumbHtml}
      <div class="cms-item-info">
        <h4>${escapeHtml(item.original_filename)}</h4>
        <p>from ${escapeHtml(item.source_table)} &middot; removed ${new Date(item.deleted_at).toLocaleDateString()}</p>
      </div>
      <div class="cms-item-actions">
        <button class="cms-btn restore-btn">Restore</button>
        <button class="cms-btn danger delete-forever-btn">Delete Permanently</button>
      </div>
    `;
    row.querySelector('.restore-btn').addEventListener('click', () => restoreFromTrash(item));
    row.querySelector('.delete-forever-btn').addEventListener('click', () => deleteForever(item));
    container.appendChild(row);
  });
}

async function restoreFromTrash(item) {
  if (!item.source_id) {
    alert('The original item this belonged to no longer exists, so it can\'t be reattached automatically. Delete it permanently instead, or re-upload it fresh.');
    return;
  }
  const { error } = await client.from(item.source_table).update({ [item.source_column]: item.storage_key }).eq('id', item.source_id);
  if (error) {
    alert('Could not restore: ' + error.message);
    return;
  }
  await client.from('media_trash').delete().eq('id', item.id);
  refreshTrash();
  refreshProjects('2d');
  refreshProjects('3d');
  refreshProjects('animation');
  refreshExhibitions();
}

async function deleteForever(item) {
  if (!confirm('Permanently delete this file from Cloudflare R2? This cannot be undone.')) return;
  await deleteFileFromR2(item.storage_key);
  await client.from('media_trash').delete().eq('id', item.id);
  refreshTrash();
}
