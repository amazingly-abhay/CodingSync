// CodingSync — GitHub OAuth Proxy
// Deploy to Cloudflare Workers (free tier: 100k req/day)
//
// 1. Go to workers.cloudflare.com → Create Worker → paste this file
// 2. Settings → Variables → Secrets → add:
//      GITHUB_CLIENT_ID     ← your OAuth App Client ID
//      GITHUB_CLIENT_SECRET ← your OAuth App Client Secret
// 3. Replace ALLOWED_EXTENSION_ID below with your Chrome extension ID
//    (from chrome://extensions after loading unpacked)
// 4. Copy your Worker URL → paste into shared/auth.js as PROXY_URL

const ALLOWED_EXTENSION_ID = 'gfdhpeanhboglngeiffomcgdkkoncddp';
// e.g. 'abcdefghijklmnopqrstuvwxyzabcdef'
// This locks the Worker so only YOUR extension can use it.
// Forks with a different extension ID will be blocked.

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const expectedOrigin = `chrome-extension://${ALLOWED_EXTENSION_ID}`;

    const corsHeaders = {
      'Access-Control-Allow-Origin': expectedOrigin,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS')
      return new Response(null, { headers: corsHeaders });

    // Block anything not from our extension
    if (origin !== expectedOrigin)
      return new Response('Forbidden', { status: 403 });

    if (request.method !== 'POST')
      return new Response('Method not allowed', { status: 405 });

    let code, redirect_uri;
    try {
      ({ code, redirect_uri } = await request.json());
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!code)
      return new Response('Missing code', { status: 400 });

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri,
      }),
    });

    const data = await res.json();

    // Never forward the raw secret — only return the token or error
    return new Response(
      JSON.stringify(
        data.access_token
          ? { access_token: data.access_token, token_type: data.token_type, scope: data.scope }
          : { error: data.error, error_description: data.error_description }
      ),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  },
};
