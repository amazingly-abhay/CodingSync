import { Storage } from './Storage.js';
import { uploadManager } from './UploadManager.js';
import { logger } from './Logger.js';
import { bus } from './EventBus.js';

const QUEUE_KEY      = 'uploadQueue';
const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 5000;

export class QueueManager {
  #processing = false;

  async enqueue(problem) {
    const { uploadQueue = [] } = await Storage.getLocal(QUEUE_KEY);
    const isDupe = uploadQueue.some(
      i => i.problem.platform === problem.platform && i.problem.slug === problem.slug
    );
    if (isDupe) { logger.info(`Already queued: ${problem.title}`); return; }

    uploadQueue.push({ problem, retries: 0, addedAt: Date.now() });
    await Storage.setLocal({ [QUEUE_KEY]: uploadQueue });
    logger.info(`Queued: ${problem.title}`);
    this.process();
  }

  async process() {
    if (this.#processing) return;
    this.#processing = true;

    try {
      while (true) {
        const { uploadQueue = [] } = await Storage.getLocal(QUEUE_KEY);
        if (!uploadQueue.length) break;

        const item = uploadQueue[0];
        try {
          await uploadManager.upload(item.problem);
          uploadQueue.shift();
          await Storage.setLocal({ [QUEUE_KEY]: uploadQueue });
          logger.info(`Upload success: ${item.problem.title}`);
        } catch (err) {
          item.retries += 1;
          logger.warn(`Upload failed (attempt ${item.retries}/${MAX_RETRIES}): ${err.message}`);

          if (item.retries >= MAX_RETRIES) {
            logger.error(`Dropping after ${MAX_RETRIES} attempts: ${item.problem.title}`);
            bus.emit('upload:failed', item.problem);
            uploadQueue.shift();
          }
          // Write back the mutated item (retries count persisted)
          await Storage.setLocal({ [QUEUE_KEY]: uploadQueue });
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    } finally {
      this.#processing = false;
    }
  }
}

export const queueManager = new QueueManager();
