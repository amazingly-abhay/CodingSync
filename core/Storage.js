export const Storage = {
  async get(keys) {
    return new Promise((res, rej) => chrome.storage.sync.get(keys, d => {
      if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
      else res(d);
    }));
  },
  async set(data) {
    return new Promise((res, rej) => chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
      else res();
    }));
  },
  async getLocal(keys) {
    return new Promise((res, rej) => chrome.storage.local.get(keys, d => {
      if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
      else res(d);
    }));
  },
  async setLocal(data) {
    return new Promise((res, rej) => chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
      else res();
    }));
  },
  async getConfig() {
    return this.get(['token', 'owner', 'repo', 'branch', 'folderStrategy', 'githubUser']);
  },
  async clearAuth() {
    return new Promise((res, rej) => chrome.storage.sync.remove(
      ['token', 'owner', 'repo', 'branch', 'folderStrategy', 'githubUser'],
      () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()
    ));
  },
};
