import { queueManager } from './core/QueueManager.js';
import { bus } from './core/EventBus.js';
import { logger } from './core/Logger.js';
import { Storage } from './core/Storage.js';

// Open setup on install; re-open on update only if not yet configured
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    return;
  }
  if (reason === 'update') {
    const { token } = await Storage.getConfig();
    if (!token) chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  }
});

// Message handler
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PROBLEM_ACCEPTED') {
    logger.info(`Received: ${msg.problem.title}`);
    queueManager.enqueue(msg.problem);
    sendResponse({ ok: true });
  } else if (msg.type === 'RETRY_QUEUE') {
    queueManager.process();
    sendResponse({ ok: true });
  } else if (msg.type === 'OPEN_SETUP') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    sendResponse({ ok: true });
  }
  return true; // keep channel open for async sendResponse
});

// Retry queue on browser startup
chrome.runtime.onStartup.addListener(() => queueManager.process());

// Create retry alarm only if it doesn't already exist
// (service workers restart frequently — chrome.alarms.create would duplicate)
chrome.alarms.get('retryQueue', alarm => {
  if (!alarm) chrome.alarms.create('retryQueue', { periodInMinutes: 5 });
});
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'retryQueue') queueManager.process();
});

// Upload events → notify popup + update stats
bus.on('upload:success', problem => {
  chrome.runtime.sendMessage({ type: 'UPLOAD_SUCCESS', problem }).catch(() => {});
  updateStats(problem);
});
bus.on('upload:failed', problem => {
  chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', problem }).catch(() => {});
});

async function updateStats(problem) {
  const { stats = {} } = await Storage.getLocal('stats');
  stats.total       = (stats.total ?? 0) + 1;
  stats.lastSolved  = problem.title;
  stats.lastSolvedAt = problem.timestamp;
  await Storage.setLocal({ stats });
}
