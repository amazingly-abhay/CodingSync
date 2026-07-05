import { pluginManager } from './core/PluginManager.js';
import { logger } from './core/Logger.js';
import './plugins/index.js';

// Track slugs already processed this session to avoid duplicate syncs
// on SPA back-navigation to the same problem page.
const processed = new Set();

async function run(url) {
  const plugin = pluginManager.resolve(url);
  if (!plugin) return;

  // Use URL pathname as the dedup key
  const key = new URL(url).pathname;
  if (processed.has(key)) return;

  logger.info(`Plugin active: ${plugin.name}`);
  plugin.initialize();

  const accepted = await plugin.detectAccepted();
  if (!accepted) return;

  // Mark before extraction so a second navigation during async work doesn't re-trigger
  processed.add(key);

  logger.info('Accepted — extracting...');
  try {
    const problem = await plugin.extractProblem();
    chrome.runtime.sendMessage({ type: 'PROBLEM_ACCEPTED', problem });
  } catch (err) {
    // Remove from processed so user can retry by re-navigating
    processed.delete(key);
    logger.error('Extraction failed:', err);
  }
}

// Initial run
run(location.href);

// Handle SPA navigation (LeetCode, GFG use client-side routing)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    run(location.href);
  }
}).observe(document.body, { childList: true, subtree: true });
