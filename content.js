import { pluginManager } from './core/PluginManager.js';
import { logger } from './core/Logger.js';
import { showToast } from './utils/toast.js';
import './plugins/index.js';

const processed = new Set();
let activeWatchKey = null;
let activePlugin = null;

// ── Cached LeetCode plugin reference ─────────────────────────────────────────
// LeetCode SPA navigation moves away from /problems/ after a submission.
// We keep a reference to the LeetCode plugin instance so the postMessage
// handler never loses it when location.href becomes /submissions/<id>/.
let cachedLeetCodePlugin = null;

function problemKey(url, plugin) {
  if (!plugin) return new URL(url).pathname;
  if (plugin.id === 'leetcode') {
    const slug = url.match(/\/problems\/([^/]+)/)?.[1];
    if (slug) return `leetcode:${slug}`;
    // If URL already changed to /submissions/ use cached slug from plugin
    // URL may already be /submissions/<id>/ — use submission ID as unique key
    const cachedSlug = plugin.submissionId ?? 'unknown';
    return `leetcode:${cachedSlug}`;
  }
  if (plugin.id === 'gfg') {
    const slug = url.match(/\/problems\/([^/]+)/)?.[1];
    if (slug) return `gfg:${slug}`;
  }
  return `${plugin.id}:${new URL(url).pathname}`;
}

async function syncProblem(plugin) {
  const key = problemKey(location.href, plugin);
  if (processed.has(key)) return;

  processed.add(key);
  logger.info('Accepted — extracting...');

  try {
    const problem = await plugin.extractProblem();
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'PROBLEM_ACCEPTED', problem }, res => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (res?.ok === false) reject(new Error('Background rejected message'));
        else resolve();
      });
    });
    showToast(`CodingSync: synced "${problem.title}"`, 'success');
  } catch (err) {
    processed.delete(key);
    logger.error('Sync failed:', err);
    showToast(`CodingSync: ${err.message}`, 'error');
  }
}

function startDomWatch(url) {
  const plugin = pluginManager.resolve(url);
  if (!plugin) return;

  // Cache the LeetCode plugin so the message handler can use it
  // even when the URL has navigated away from /problems/.
  if (plugin.id === 'leetcode') cachedLeetCodePlugin = plugin;

  const key = problemKey(url, plugin);
  if (processed.has(key)) return;

  if (activeWatchKey !== key) {
    // Clean up the OLD plugin's observer before swapping references
    const outgoing = activePlugin;
    activeWatchKey = key;
    activePlugin = plugin;
    outgoing?.initialize();              // cancel outgoing AFTER assigning new refs
    logger.info(`Plugin active: ${plugin.name}`);
  }

  plugin.detectAccepted().then(accepted => {
    if (!accepted || activePlugin !== plugin || activeWatchKey !== key) return;

    if (plugin.id === 'leetcode') {
      // DOM-based fallback: wait 1.5s for URL to settle, then capture
      // submission ID from the new /problems/<slug>/<submissionId>/ URL.
      // The inject-script path (postMessage) takes priority via the processed Set.
      setTimeout(() => {
        if (!plugin.submissionId) {
          const idFromUrl = plugin.getSubmissionIdFromUrl();
          if (idFromUrl) {
            logger.info(`DOM fallback: got submissionId from URL: ${idFromUrl}`);
            plugin.submissionId = idFromUrl;
          }
        }
        syncProblem(plugin);
      }, 1500);
    } else {
      syncProblem(plugin);
    }
  });
}

// ── LeetCode postMessage listener ─────────────────────────────────────────────
window.addEventListener('message', async e => {
  if (e.source !== window || e.data?.source !== 'codingsync') return;

  if (e.data.type === 'leetcode-submission-id') {
    // Prefer the cached plugin; fall back to URL resolve for safety
    const plugin = cachedLeetCodePlugin ?? pluginManager.resolve(location.href);
    if (plugin?.id === 'leetcode') plugin.submissionId = e.data.submissionId;
    return;
  }

  if (e.data.type === 'leetcode-accepted') {
    // Use cached plugin — URL may already be /submissions/<id>/ at this point
    const plugin = cachedLeetCodePlugin ?? pluginManager.resolve(location.href);
    if (!plugin || plugin.id !== 'leetcode') return;
    if (e.data.submissionId) plugin.submissionId = e.data.submissionId;
    await syncProblem(plugin);
  }
});

startDomWatch(location.href);

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    startDomWatch(location.href);
  }
}).observe(document.body, { childList: true, subtree: true });
