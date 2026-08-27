// ==========================================================================
// AgrabanArt — shared site behavior
// Handles: nav background on scroll, mobile menu toggle, scroll-reveal
// animations, sub-nav scroll-spy, and the 3D model / video carousels on
// the Projects page.
//
// COMMENT: the model/video carousels below start out empty (showing their
// placeholder text) and are populated by site-data.js once it fetches
// content from Supabase. window.AgrabanCarousels exposes .updateModels()
// and .updateVideos() for that purpose — you shouldn't need to touch this
// file when adding real content, only script the carousels are re-used by
// site-data.js.
// ==========================================================================

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
  // Generic carousel controller. Data can be swapped out later via
  // .update(newData) — that's what lets site-data.js hand it live content
  // fetched from Supabase after the page has already loaded.
  // ---------------------------------------------------------------------
  function createCarousel({ prevBtn, nextBtn, container, placeholderEl, caption, hasContent, renderItem }) {
    let data = [{ title: 'Nothing added yet', empty: true }];
    let index = 0;

    const render = () => {
      const item = data[index];
      const filled = !item.empty && hasContent(item);
      if (placeholderEl) placeholderEl.style.display = filled ? 'none' : 'flex';
      if (container) {
        container.style.display = filled ? 'block' : 'none';
        if (filled) renderItem(item, container);
      }
      if (caption) {
        caption.textContent = item.empty
          ? 'Nothing added yet'
          : `${index + 1} of ${data.length} — ${item.title}`;
      }
    };

    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => {
        index = (index - 1 + data.length) % data.length;
        render();
      });
      nextBtn.addEventListener('click', () => {
        index = (index + 1) % data.length;
        render();
      });
    }

    render();

    return {
      update(newData) {
        data = newData && newData.length ? newData : [{ title: 'Nothing added yet', empty: true }];
        index = 0;
        render();
      },
    };
  }

  const modelCarousel = createCarousel({
    prevBtn: document.getElementById('model-prev'),
    nextBtn: document.getElementById('model-next'),
    container: document.getElementById('model-viewer'),
    placeholderEl: document.getElementById('model-placeholder-text'),
    caption: document.getElementById('model-caption'),
    hasContent: (item) => !!item.src,
    renderItem: (item, el) => {
      el.setAttribute('src', item.src);
      el.setAttribute('alt', item.title);
    },
  });

  const videoCarousel = createCarousel({
    prevBtn: document.getElementById('video-prev'),
    nextBtn: document.getElementById('video-next'),
    container: document.getElementById('video-media-wrap'),
    placeholderEl: document.getElementById('video-placeholder-text'),
    caption: document.getElementById('video-caption'),
    hasContent: (item) => !!(item.type === 'youtube' ? item.id : item.src),
    renderItem: (item, el) => {
      el.innerHTML = '';
      if (item.type === 'youtube') {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${item.id}`;
        iframe.style.cssText = 'width:100%; height:100%; border:0;';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        el.appendChild(iframe);
      } else {
        const video = document.createElement('video');
        video.src = item.src;
        video.controls = true;
        video.style.cssText = 'width:100%; height:100%;';
        el.appendChild(video);
      }
    },
  });

  // Exposed so site-data.js can feed live Supabase content into the
  // carousels once it's fetched.
  window.AgrabanCarousels = {
    updateModels: (data) => modelCarousel.update(data),
    updateVideos: (data) => videoCarousel.update(data),
  };

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

  // Scroll-reveal for sections and slash dividers.
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      )
    : null;

  const observeReveal = (el) => {
    if (observer) observer.observe(el);
    else el.classList.add('is-visible');
  };

  document.querySelectorAll('.reveal, .slash-divider').forEach(observeReveal);

  // Exposed so site-data.js can register newly-created elements (project
  // tiles, award rows, etc.) for the same fade-in-on-scroll treatment.
  window.AgrabanReveal = { observe: observeReveal };
});
