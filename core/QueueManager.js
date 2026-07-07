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
    const queue = await this.#loadQueue();

    const exists = queue.some(
      item =>
        item.problem.platform === problem.platform &&
        item.problem.slug === problem.slug
    );

    if (exists) {
      logger.info(`Already queued: ${problem.title}`);
      return;
    }

    queue.push({
      problem,
      retries: 0,
      addedAt: Date.now()
    });

    await this.#saveQueue(queue);

    logger.info(`Queued: ${problem.title}`);

    this.process();
  }

async process() {
    if (this.#processing) return;

    this.#processing = true;

    try {
      const queue = await this.#loadQueue();

      while (queue.length) {
        const item = queue[0];

        try {
          await uploadManager.upload(item.problem);

          logger.info(`Upload success: ${item.problem.title}`);

          bus.emit('upload:success', item.problem);

          queue.shift();
        } catch (err) {
          item.retries++;

          logger.warn(
            `Upload failed (${item.retries}/${MAX_RETRIES}): ${err.message}`
          );

          if (item.retries >= MAX_RETRIES) {
            logger.error(`Dropping: ${item.problem.title}`);

            bus.emit('upload:failed', item.problem);

            queue.shift();
          } else {
            const delay =
              BASE_RETRY_DELAY * Math.pow(2, item.retries - 1);

            await this.#saveQueue(queue);

            await this.#sleep(delay);

            continue;
          }
        }

        await this.#saveQueue(queue);
      }
    } catch (err) {
      logger.error(`Queue processing error: ${err.message}`);
    } finally {
      this.#processing = false;
    }
  }

  async #loadQueue() {
    const { uploadQueue = [] } = await Storage.getLocal(QUEUE_KEY);
    return uploadQueue;
  }

  async #saveQueue(queue) {
    await Storage.setLocal({
      [QUEUE_KEY]: queue
    });
  }

  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const queueManager = new QueueManager();
