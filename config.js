// ============================================================================
// AgrabanArt — shared connection config
// ============================================================================
// COMMENT: fill these four values in once you've set up Supabase and
// Cloudflare (see README.md for the full setup steps). This file is loaded
// by both the CMS (cms.html) and the main site pages, so you only need to
// update it in one place.
//
// SUPABASE_URL / SUPABASE_ANON_KEY come from your Supabase project's
// Settings -> API page. The "anon" key is safe to put in frontend code —
// it's designed to be public; write access is still locked down by the
// Row Level Security policies in supabase-schema.sql.
//
// MEDIA_WORKER_URL is the deployed Cloudflare Worker URL (see
// cloudflare-worker/media-worker.js for deploy steps).
//
// MEDIA_PUBLIC_BASE_URL is the public base URL of your R2 bucket, used to
// actually display images/videos on the site once uploaded (e.g.
// "https://media.agrabanart.com" or "https://pub-xxxx.r2.dev"). Don't
// include a trailing slash.
// ============================================================================

window.AGRABAN_CONFIG = {
  SUPABASE_URL: 'https://zomtiesfamoxkumxonqe.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXRpZXNmYW1veGt1bXhvbnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTY0NDUsImV4cCI6MjEwMTU3MjQ0NX0.tmTCXWB_zJ8F5qWL1jp9gVNWxkxqXV2s9zofz80pLXw',
  MEDIA_WORKER_URL: 'https://agrabanart-media-worker.agraban-media.workers.dev',
  MEDIA_PUBLIC_BASE_URL: 'https://pub-b8ff7184833141548c751c25e6f635c8.r2.dev',
};
