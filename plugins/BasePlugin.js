export class BasePlugin {
  /** @type {string} */ id = '';
  /** @type {string} */ name = '';
  /** @type {string[]} */ hostnames = [];

  /** @param {string} url */
  isSupported(url) { return false; }

  /** @type {MutationObserver|null} */
  #observer = null;
  /** @type {((value: boolean) => void)|null} */
  #resolveAccepted = null;

  initialize() {
    if (this.#resolveAccepted) {
      this.#resolveAccepted(false);
      this.#resolveAccepted = null;
    }
    this.#disconnectObserver();
  }

  #disconnectObserver() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /**
   * Watch the DOM until checkFn() is true. Stays active until accepted,
   * initialize() runs again (SPA navigation), or the tab closes.
   * @param {() => boolean} checkFn
   * @returns {Promise<boolean>}
   */
  watchForAccepted(checkFn) {
    return new Promise(resolve => {
      if (checkFn()) { resolve(true); return; }

      this.#resolveAccepted = resolve;
      const obs = new MutationObserver(() => {
        if (checkFn()) {
          this.#resolveAccepted = null;
          this.#disconnectObserver();
          resolve(true);
        }
      });
      this.#observer = obs;
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  /** @returns {Promise<boolean>} */
  async detectAccepted() { throw new Error(`${this.id}: detectAccepted not implemented`); }

  /** @returns {Promise<import('../../shared/problem.js').Problem>} */
  async extractProblem() { throw new Error(`${this.id}: extractProblem not implemented`); }

  /** @returns {Promise<string>} */
  async extractSolution() { throw new Error(`${this.id}: extractSolution not implemented`); }

  /** @returns {Promise<{runtime:string, memory:string}>} */
  async extractMetadata() { return { runtime: 'N/A', memory: 'N/A' }; }

  // Helper: wait for a DOM element
  waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  // Helper: slugify title
  slugify(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
