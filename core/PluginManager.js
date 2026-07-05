import { logger } from './Logger.js';

class PluginManager {
  #registry = new Map(); // id → plugin instance

  register(plugin) {
    this.#registry.set(plugin.id, plugin);
    logger.info(`Plugin registered: ${plugin.id}`);
  }

  resolve(url) {
    const host = new URL(url).hostname;
    for (const plugin of this.#registry.values()) {
      if (plugin.hostnames.some(h => host.endsWith(h)) && plugin.isSupported(url))
        return plugin;
    }
    return null;
  }

  getAll() { return [...this.#registry.values()]; }
}

export const pluginManager = new PluginManager();
