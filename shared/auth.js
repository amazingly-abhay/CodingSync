// GitHub OAuth via chrome.identity.launchWebAuthFlow + Cloudflare Worker proxy
//
// CLIENT_ID  → safe to be public (identifies the app, not a secret)
// CLIENT_SECRET → lives ONLY in Cloudflare Worker secrets, never in this file
//
// ── One-time setup ────────────────────────────────────────────────────────────
// 1. Load extension → copy Extension ID from chrome://extensions
// 2. github.com/settings/developers → New OAuth App
//    · Callback URL: https://<EXTENSION_ID>.chromiumapp.org/
// 3. Copy Client ID → paste below as CLIENT_ID
// 4. Deploy worker/oauth-proxy.js to Cloudflare Workers
//    · Add GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET as Worker Secrets
//    · Set ALLOWED_EXTENSION_ID in the Worker to your Extension ID
// 5. Copy Worker URL → paste below as PROXY_URL
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ID = '__YOUR_CLIENT_ID__';
// e.g. 'Ov23liXXXXXXXXXXXX'
// Safe to commit — this is public by design in OAuth.

const PROXY_URL = '__YOUR_PROXY_URL__';
// e.g. 'https://codingsync-oauth.yourname.workers.dev'
// Root Worker URL only — no /exchange path. Safe to commit.

const REDIRECT_URI = () => chrome.identity.getRedirectURL();
const SCOPES       = 'repo user:email';
const AUTH_URL     = 'https://github.com/login/oauth/authorize';
const USER_URL     = 'https://api.github.com/user';

export async function launchOAuth() {
  if (CLIENT_ID.startsWith('__') || PROXY_URL.startsWith('__'))
    throw new Error('OAuth not configured — follow README Option A or B to set CLIENT_ID and PROXY_URL in shared/auth.js');

  const state       = crypto.randomUUID();
  const redirectUri = REDIRECT_URI();

  const authUrl = `${AUTH_URL}?` + new URLSearchParams({
    client_id:    CLIENT_ID,
    redirect_uri: redirectUri,
    scope:        SCOPES,
    state,
  });

  // Opens GitHub's "Authorize application" page in a popup.
  // User clicks Authorize → Chrome catches the redirect automatically.
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      url => {
        if (chrome.runtime.lastError || !url)
          reject(new Error(chrome.runtime.lastError?.message ?? 'Auth cancelled'));
        else resolve(url);
      }
    );
  });

  const params = new URL(responseUrl).searchParams;
  if (params.get('state') !== state) throw new Error('State mismatch — possible CSRF');
  const code = params.get('code');
  if (!code) throw new Error('No authorization code returned from GitHub');

  // Exchange code via Worker — CLIENT_SECRET never touches the extension
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  return data.access_token;
}

export async function getGitHubUser(token) {
  const res = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch GitHub user (${res.status})`);
  return res.json();
}

export async function createRepo(token, name, isPrivate) {
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      description: 'Competitive programming solutions synced by CodingSync',
      auto_init: true,
    }),
  });
  if (res.status === 422) throw new Error('repo_exists');
  if (!res.ok) throw new Error(`Failed to create repo (${res.status})`);
  return res.json();
}
