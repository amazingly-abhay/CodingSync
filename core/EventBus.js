export class EventBus {
  #listeners = new Map();

  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const listeners = this.#listeners.get(event);

    if (!listeners) return;

    listeners.delete(fn);

    if (listeners.size === 0) {
        this.#listeners.delete(event);
    }
}

  emit(event, data) {
    const listeners = this.#listeners.get(event);

    if (!listeners) return;

    for (const fn of listeners) {
        try {
            fn(data);
        } catch (err) {
            console.error(err);
        }
    }
}
}

export const bus = new EventBus();
