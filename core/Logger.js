const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  #level = 1;

  setLevel(level) { this.#level = LEVELS[level] ?? 1; }

  #log(level, ...args) {
    if (LEVELS[level] >= this.#level)
      console[level](`[CodingSync:${level.toUpperCase()}]`, ...args);
  }

  debug = (...a) => this.#log('debug', ...a);
  info  = (...a) => this.#log('info',  ...a);
  warn  = (...a) => this.#log('warn',  ...a);
  error = (...a) => this.#log('error', ...a);
}

export const logger = new Logger();
