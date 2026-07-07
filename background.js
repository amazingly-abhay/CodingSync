import { queueManager } from './core/QueueManager.js';
import { bus } from './core/EventBus.js';
import { logger } from './core/Logger.js';
import { Storage } from './core/Storage.js';

// Open setup on install; re-open on update only if not yet configured
/* ------------------------- Installation ------------------------- */
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const setupUrl = chrome.runtime.getURL('options/options.html');

  if (reason === 'install') {
    chrome.tabs.create({ url: setupUrl });
    return;
  }

  if (reason === 'update') {
    const { token } = await Storage.getConfig();
    if (!token) {
      chrome.tabs.create({ url: setupUrl });
    }
  }
});

// Message handler
/* ------------------------- Message Handlers ------------------------- */
const messageHandlers = {
  async PROBLEM_ACCEPTED(msg) {
    if (!msg.problem?.title) {
      throw new Error('Invalid problem payload.');
    }

    logger.info(`Received: ${msg.problem.title}`);
    await queueManager.enqueue(msg.problem);

    return { ok: true };
  },

  async RETRY_QUEUE() {
    await queueManager.process();
    return { ok: true };
  },

  async OPEN_SETUP() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });

    return { ok: true };
  }
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = messageHandlers[msg.type];

  if (!handler) {
    sendResponse({
      ok: false,
      error: `Unknown message type: ${msg.type}`
    });
    return false;
  }

  handler(msg)
    .then(sendResponse)
    .catch(error => {
      logger.error(error);
      sendResponse({
        ok: false,
        error: error.message
      });
    });

  return true;
});

/* ------------------------- Startup ------------------------- */
chrome.runtime.onStartup.addListener(() => {
  queueManager.process();
});

/* ------------------------- Retry Alarm ------------------------- */
const RETRY_ALARM = 'retryQueue';

chrome.alarms.get(RETRY_ALARM, alarm => {
  if (!alarm) {
    chrome.alarms.create(RETRY_ALARM, {
      periodInMinutes: 5
    });
  }
});

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === RETRY_ALARM) {
    queueManager.process();
  }
});

/* ------------------------- Upload Events ------------------------- */
bus.on('upload:success', async problem => {
  chrome.runtime
    .sendMessage({
      type: 'UPLOAD_SUCCESS',
      problem
    })
    .catch(() => {});

  await updateStats(problem);
});

bus.on('upload:failed', problem => {
  chrome.runtime
    .sendMessage({
      type: 'UPLOAD_FAILED',
      problem
    })
    .catch(() => {});
});
/* ------------------------- Statistics ------------------------- */
async function updateStats(problem) {
  const { stats = {} } = await Storage.getLocal('stats');

  const updatedStats = {
    ...stats,
    total: (stats.total ?? 0) + 1,
    lastSolved: problem.title,
    lastSolvedAt: problem.timestamp
  };

  await Storage.setLocal({
    stats: updatedStats
  });
}