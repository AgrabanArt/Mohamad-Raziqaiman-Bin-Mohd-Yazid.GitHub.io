// ============================================================================
// AgrabanArt — shared connection config
// ============================================================================
// COMMENT: fill these four values in once you've set up Supabase and
// Cloudflare (see README.md for the full setup steps). This file is loaded
// by both the CMS (cms.html) and the main site pages, so you only need to
// update it in one place.
// ============================================================================

window.AGRABAN_CONFIG = {
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  MEDIA_WORKER_URL: 'https://agrabanart-media-worker.your-subdomain.workers.dev',
  MEDIA_PUBLIC_BASE_URL: 'https://media.agrabanart.com',
};
