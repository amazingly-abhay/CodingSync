# CodingSync

> Automatically sync your accepted competitive programming solutions to GitHub — the moment you hit **Accepted**.

No manual copying. No backend. Solutions land in your GitHub repo with a full README, examples, constraints, and stats.

---

## Supported Platforms

| Platform | Accepted Detection | Problem Data | Solution Source |
|---|---|---|---|
| LeetCode | DOM + MutationObserver | GraphQL API | Monaco editor |
| Codeforces | DOM verdict | DOM scrape | Submission page |
| GeeksForGeeks | DOM + MutationObserver | DOM scrape | Monaco / CodeMirror |
| CodeChef | DOM + MutationObserver | DOM scrape | Monaco / CodeMirror |
| AtCoder | DOM + MutationObserver | DOM scrape | Submission page |

---

## What gets synced

Every accepted solution creates two files in your GitHub repo:

```
LeetCode/Easy/two-sum/
  README.md       ← title, description, examples, constraints, tags, runtime, memory
  solution.py     ← your exact solution code
```

---

## Choose your setup path

There are **3 ways** to use CodingSync depending on your needs:

| | [Option A](#option-a--use-the-maintainers-hosted-version-easiest) | [Option B](#option-b--self-hosted-your-own-oauth-app) | [Option C](#option-c--publish-to-chrome-web-store) |
|---|---|---|---|
| Who sets up OAuth? | Maintainer (done) | You | You |
| User setup time | ~1 min | ~15 min | ~30 sec (Web Store install) |
| Your own OAuth App? | No | Yes | Yes |
| Cost | Free | Free | $5 one-time (Web Store fee) |
| Best for | Personal use / sharing repo | Full independence | Public distribution |

---

## Option A — Use the maintainer's hosted version (easiest)

> The repo already has a working OAuth App and Cloudflare Worker set up.
> Users just download and authorize — no configuration needed.

### Who this is for
- You want to use CodingSync for yourself
- You want to share the repo with friends so they can use it too
- Nobody wants to deal with OAuth App setup

### How it works
- The maintainer's GitHub OAuth App handles authorization for everyone
- Each user authorizes with **their own GitHub account** — solutions go to **their own repo**
- The OAuth App is just the doorway — it never touches your solutions or repos

### Setup (for each user)

**Step 1 — Load the extension**
1. Download or clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked** → select the `CodingSync` folder
5. The extension icon appears in your toolbar

**Step 2 — Authorize**
1. Click the CodingSync icon
2. Click **Connect GitHub**
3. GitHub's authorization page opens — click **Authorize CodingSync**
4. You're redirected back automatically — authorization complete

**Step 3 — Set up your repo**
1. Enter a repository name (e.g. `coding-solutions`)
2. Choose **Private** or **Public**
3. Choose a folder strategy
4. Click **Finish** — the repo is created automatically on your GitHub

**That's it.** Solve a problem → get Accepted → it syncs.

---

## Option B — Self-hosted (your own OAuth App)

> Full independence. Your own OAuth App, your own Worker, your own everything.
> No dependency on the maintainer's infrastructure.

### Who this is for
- You want to fork this project and run it completely independently
- You want your own branding on the GitHub authorization screen
- You don't want to rely on anyone else's OAuth App

### Step 1 — Load the extension and get your Extension ID

1. Download or clone this repo
2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the `CodingSync` folder
4. Copy the **Extension ID** shown (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)

### Step 2 — Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in the form:

   | Field | Value |
   |---|---|
   | Application name | `CodingSync` |
   | Homepage URL | `https://github.com` |
   | Application description | *(optional)* |
   | Authorization callback URL | `https://<YOUR_EXTENSION_ID>.chromiumapp.org/` |
   | Enable Device Flow | leave unchecked |

4. Click **Register application**
5. Copy the **Client ID** (shown on the page)
6. Click **Generate a new client secret** → copy it immediately (shown only once)

### Step 3 — Deploy the Cloudflare Worker

The Worker holds your Client Secret server-side. It's free (100k requests/day).

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) → sign up free → **Create a Worker**
2. Paste the contents of `worker/oauth-proxy.js` into the editor
3. In the Worker code, replace `__YOUR_EXTENSION_ID__` with your actual Extension ID:
   ```js
   const ALLOWED_EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyzabcdef';
   ```
4. Click **Save and Deploy**
5. Go to **Settings → Variables → Secrets** → add two secrets:
   - `GITHUB_CLIENT_ID` → your Client ID
   - `GITHUB_CLIENT_SECRET` → your Client Secret
6. Copy your Worker URL (e.g. `https://codingsync-oauth.yourname.workers.dev`)

### Step 4 — Update `shared/auth.js`

Open `shared/auth.js` and replace the two placeholder lines:

```js
const CLIENT_ID = 'Ov23liXXXXXXXXXXXX';                              // your Client ID
const PROXY_URL = 'https://codingsync-oauth.yourname.workers.dev/exchange'; // your Worker URL
```

> `CLIENT_ID` and `PROXY_URL` are **safe to commit** — neither is a secret.
> Your `CLIENT_SECRET` lives only in Cloudflare and never touches this file.

### Step 5 — Reload and test

1. Go to `chrome://extensions` → click the **refresh icon** on CodingSync
2. Click the extension icon → **Connect GitHub** → authorize → done

### Sharing with others (Option B)

If you push your fork to GitHub with your real `CLIENT_ID` and `PROXY_URL` filled in,
anyone who downloads your fork gets the same one-click experience as Option A —
they just load unpacked and authorize. No setup needed on their end.

---

## Option C — Publish to Chrome Web Store

> One-click install for anyone. No load unpacked, no developer mode.

### Who this is for
- You want to distribute CodingSync publicly
- You want users to install from the Chrome Web Store like any normal extension

### Additional steps on top of Option B

1. Complete all steps in **Option B** first
2. Pay the **$5 one-time** Chrome Web Store developer registration fee at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
3. Zip the extension folder (exclude `worker/`, `README.md`, `.git/`)
4. Upload the zip → fill in store listing → submit for review
5. Once approved, users install directly from the Web Store

> **Note:** After publishing, your Extension ID is permanent and fixed.
> Update `ALLOWED_EXTENSION_ID` in your Worker and the callback URL in your OAuth App to match the published ID (it may differ from your unpacked development ID).

---

## Folder Strategies

Controls how solutions are organized in your GitHub repo:

| Strategy | Example path | Best for |
|---|---|---|
| `platform_difficulty` | `LeetCode/Easy/two-sum/` | Browsing by platform and difficulty |
| `platform` | `LeetCode/two-sum/` | Browsing by platform only |
| `difficulty` | `Easy/two-sum/` | Browsing by difficulty only |
| `flat` | `two-sum/` | Simple flat list |

---

## Security model

| What | Where it lives | Safe to commit to GitHub? |
|---|---|---|
| `CLIENT_ID` | `shared/auth.js` | ✅ Yes — public by design in OAuth |
| `PROXY_URL` | `shared/auth.js` | ✅ Yes — a URL, not a secret |
| `CLIENT_SECRET` | Cloudflare Worker Secrets dashboard | ✅ Never in the repo |
| User's GitHub token | `chrome.storage.sync` (user's browser only) | ✅ Never leaves their machine |
| User's solutions | User's own GitHub repo | ✅ Under their full control |

**Why is CLIENT_SECRET safe in Cloudflare?**
Cloudflare Worker Secrets are encrypted at rest and only injected at runtime via `env.GITHUB_CLIENT_SECRET`. They are never visible in the Worker source code, never in logs, and never returned in responses.

**Why can't someone abuse your OAuth App?**
The Cloudflare Worker is locked to your specific Extension ID via the `ALLOWED_EXTENSION_ID` check. Any request from a different origin (e.g. a fork with a different extension ID) gets `403 Forbidden`. Even if someone copies your `CLIENT_ID`, they can't exchange codes without going through your Worker.

---

## Architecture

```
chrome.identity.launchWebAuthFlow
  └─ GitHub OAuth authorize page (user clicks Authorize)
       └─ code → Cloudflare Worker (holds CLIENT_SECRET)
            └─ access_token → stored in chrome.storage.sync

Content Script (per platform)
  └─ Plugin (LeetCode / Codeforces / GFG / CodeChef / AtCoder)
       └─ detectAccepted() → extractProblem() + extractSolution()
            └─ chrome.runtime.sendMessage → Background Service Worker
                 └─ QueueManager (persistent retry queue)
                      └─ UploadManager
                           ├─ MarkdownGenerator → README.md
                           ├─ RepositoryManager → folder path
                           └─ GitHubClient → atomic tree API commit
```

### Core modules

| Module | Role |
|---|---|
| `EventBus` | Decoupled pub/sub between modules |
| `PluginManager` | Registry + factory, resolves plugin by URL |
| `BasePlugin` | Interface all platform plugins implement |
| `QueueManager` | Persistent upload queue with retry (chrome.storage.local) |
| `UploadManager` | Orchestrates GitHub commit from a Problem object |
| `MarkdownGenerator` | Builds README.md from problem data |
| `RepositoryManager` | Applies folder strategy to build file paths |
| `GitHubClient` | Atomic multi-file commits via Git tree API |

---

## Adding a new platform

1. Create `plugins/<platform>/<Platform>Plugin.js` extending `BasePlugin`
2. Implement four methods: `isSupported`, `detectAccepted`, `extractProblem`, `extractSolution`
3. Add one line to `plugins/index.js`:
   ```js
   import { NewPlugin } from './newplatform/NewPlugin.js';
   // add NewPlugin to the array
   ```
4. Zero changes needed anywhere else

---

## FAQ

**Q: Do my solutions go to the maintainer's GitHub?**
No. Your solutions always go to your own GitHub repo. The OAuth App only authenticates you — it has no access to your repos beyond what you grant.

**Q: What GitHub permissions does CodingSync request?**
`repo` (to create/write to repos) and `user:email` (to identify your account). It requests the minimum needed.

**Q: Can I use a private repo?**
Yes. During setup you choose Private or Public. You can change it on GitHub anytime.

**Q: What if I'm offline when a solution is accepted?**
The upload is queued in `chrome.storage.local` and retried automatically every 5 minutes and on browser restart.

**Q: Does this work on Firefox?**
Not currently. `chrome.identity.launchWebAuthFlow` is Chrome/Chromium only. Firefox support would require a different auth approach.

**Q: I forked this repo and want my own OAuth. Do I need to pay anything?**
No. GitHub OAuth Apps are free. Cloudflare Workers free tier (100k req/day) is more than enough. Only the Chrome Web Store charges ($5 one-time, only if you want to publish publicly).
