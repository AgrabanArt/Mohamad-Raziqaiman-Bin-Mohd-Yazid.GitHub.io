// ============================================================================
// AgrabanArt CMS — Cloudflare Worker (media broker)
// ============================================================================
// WHY THIS EXISTS:
// Browsers can't safely talk to an R2 bucket directly — doing so would mean
// putting a secret R2 access key inside the CMS's frontend code, which
// anyone could steal from the browser and use to wipe your bucket. Instead,
// the CMS sends uploads/deletes to THIS Worker. The Worker holds the secure
// R2 binding (no secret keys exposed anywhere in the browser), checks that
// the request really came from your logged-in admin account via Supabase,
// and only then touches the bucket.
//
// HOW TO DEPLOY THIS:
// 1. Install Wrangler (Cloudflare's CLI): npm install -g wrangler
// 2. Create an R2 bucket in the Cloudflare dashboard (R2 -> Create bucket),
//    e.g. name it "agrabanart-media"
// 3. Enable public access on the bucket (R2 -> your bucket -> Settings ->
//    Public Access) or connect a custom domain to it — you'll need the
//    resulting public base URL for config.js later (e.g.
//    https://media.agrabanart.com or https://pub-xxxx.r2.dev)
// 4. Edit wrangler.toml in this folder: set your bucket name and account ID
// 5. Set the two secrets this Worker needs (run these in this folder):
//      wrangler secret put SUPABASE_URL
//      wrangler secret put ADMIN_EMAIL
//    (SUPABASE_URL is your project's URL, e.g. https://xxxx.supabase.co —
//    ADMIN_EMAIL is the email address of your admin login, used as an
//    extra sanity check alongside the admins table in Supabase)
// 6. Deploy: wrangler deploy
// 7. Copy the deployed Worker URL (looks like
//    https://agrabanart-media-worker.your-subdomain.workers.dev) into
//    config.js as MEDIA_WORKER_URL
// ============================================================================

export default {
  async fetch(request, env) {
    // Allow the CMS page (running in the browser) to call this Worker
    // from a different domain.
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // COMMENT: for tighter security once live, replace '*' with your actual site URL, e.g. 'https://agrabanart.github.io'
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ------------------------------------------------------------------
    // Step 1: verify the request is from a logged-in admin.
    // The CMS sends the Supabase access token in the Authorization header
    // as "Bearer <token>". We ask Supabase to confirm it's valid and get
    // back the user's email, which we compare against ADMIN_EMAIL.
    // ------------------------------------------------------------------
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response('Missing auth token', { status: 401, headers: corsHeaders });
    }

    const userCheck = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: token, // Supabase accepts the user's own access token here
      },
    });

    if (!userCheck.ok) {
      return new Response('Invalid or expired session', { status: 401, headers: corsHeaders });
    }

    const user = await userCheck.json();
    if (user.email !== env.ADMIN_EMAIL) {
      return new Response('Not authorized', { status: 403, headers: corsHeaders });
    }

    // ------------------------------------------------------------------
    // Step 2: handle the actual upload or delete.
    // Object key comes in as a query param, e.g. ?key=projects/piece-01.jpg
    // ------------------------------------------------------------------
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return new Response('Missing "key" query param', { status: 400, headers: corsHeaders });
    }

    if (request.method === 'PUT') {
      // Upload (or overwrite) a file in the bucket
      await env.MEDIA_BUCKET.put(key, request.body, {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
      });
      return new Response(JSON.stringify({ success: true, key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'DELETE') {
      // Permanently remove a file from the bucket (called only when an
      // item is deleted forever from the CMS Trash tab)
      await env.MEDIA_BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true, key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  },
};
