// ==========================================================================
// AgrabanArt — shared site behavior
// Handles: nav background on scroll, mobile menu toggle, and the
// scroll-reveal / slash-divider entrance animations.
// ==========================================================================

// ==========================================================================
// AgrabanArt — shared site behavior
// Handles: nav background on scroll, mobile menu toggle, scroll-reveal
// animations, and the 3D model / video carousels on the Projects page.
// ==========================================================================

// ---------------------------------------------------------------------
// MODEL CAROUSEL DATA — edit this array to add, remove, or reorder the
// models shown in the 3D Modelling carousel on projects.html.
// Leave src as "" to show the placeholder for that slot; fill it in with
// a path to a .glb/.gltf file once it's ready (e.g. "models/piece-01.glb").
// ---------------------------------------------------------------------
const models = [
  { title: 'Project Title', src: '' },
  { title: 'Project Title', src: '' },
  { title: 'Project Title', src: '' },
];

// ---------------------------------------------------------------------
// VIDEO CAROUSEL DATA — edit this array to add, remove, or reorder the
// clips shown in the Animation Showreel carousel on projects.html.
// Leave src as "" to show the placeholder for that slot; fill it in with
// a path to a video file once it's ready (e.g. "media/reel-01.mp4").
// ---------------------------------------------------------------------
const videos = [
  { title: 'Project Title', src: '' },
  { title: 'Project Title', src: '' },
  { title: 'Project Title', src: '' },
];

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  // Nav background changes once the page is scrolled
  const onScroll = () => {
    if (window.scrollY > 8) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('is-open');
    });
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navLinks.classList.remove('is-open'));
    });
  }

  // ---------------------------------------------------------------------
  // Generic carousel wiring — used for both the 3D model and video
  // carousels. Swaps content based on the data arrays defined above and
  // updates the "X of N" caption.
  // ---------------------------------------------------------------------
  function setupCarousel({ data, prevBtn, nextBtn, mediaEl, placeholderEl, caption, apply }) {
    if (!prevBtn || !nextBtn) return;
    let index = 0;

    const render = () => {
      const item = data[index];
      const hasSrc = item && item.src;
      if (mediaEl) mediaEl.style.display = hasSrc ? 'block' : 'none';
      if (placeholderEl) placeholderEl.style.display = hasSrc ? 'none' : 'flex';
      if (hasSrc) apply(item);
      if (caption) caption.textContent = `${index + 1} of ${data.length} — ${item.title}`;
    };

    prevBtn.addEventListener('click', () => {
      index = (index - 1 + data.length) % data.length;
      render();
    });
    nextBtn.addEventListener('click', () => {
      index = (index + 1) % data.length;
      render();
    });

    render();
  }

  setupCarousel({
    data: models,
    prevBtn: document.getElementById('model-prev'),
    nextBtn: document.getElementById('model-next'),
    mediaEl: document.getElementById('model-viewer'),
    placeholderEl: document.getElementById('model-placeholder-text'),
    caption: document.getElementById('model-caption'),
    apply: (item) => {
      const viewer = document.getElementById('model-viewer');
      viewer.setAttribute('src', item.src);
      viewer.setAttribute('alt', item.title);
    },
  });

  setupCarousel({
    data: videos,
    prevBtn: document.getElementById('video-prev'),
    nextBtn: document.getElementById('video-next'),
    mediaEl: document.getElementById('showreel-video'),
    placeholderEl: document.getElementById('video-placeholder-text'),
    caption: document.getElementById('video-caption'),
    apply: (item) => {
      const video = document.getElementById('showreel-video');
      video.src = item.src;
    },
  });

  // Sub-nav scroll-spy (Projects / Events pages) — highlights the tab
  // matching whichever section is currently in view
  const subnavLinks = document.querySelectorAll('.subnav-list a');
  if (subnavLinks.length) {
    const spySections = Array.from(subnavLinks)
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    const updateActiveSubnav = () => {
      const scrollPos = window.scrollY + 170;
      let current = spySections[0];
      spySections.forEach((sec) => {
        if (sec.offsetTop <= scrollPos) current = sec;
      });
      subnavLinks.forEach((link) => {
        const target = document.querySelector(link.getAttribute('href'));
        link.classList.toggle('is-active', target === current);
      });
    };

    window.addEventListener('scroll', updateActiveSubnav, { passive: true });
    updateActiveSubnav();
  }

  // Scroll-reveal for sections and slash dividers
  const revealTargets = document.querySelectorAll('.reveal, .slash-divider');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach((el) => observer.observe(el));
  } else {
    // Fallback: no IntersectionObserver support, just show everything
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }
});
