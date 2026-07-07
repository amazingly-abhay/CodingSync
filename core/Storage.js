const createStorage = area => ({
  get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(keys, result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  },

  set(data) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
});

const syncStorage = createStorage('sync');
const localStorage = createStorage('local');

export const Storage = Object.freeze({
  get: syncStorage.get,
  set: syncStorage.set,

  getLocal: localStorage.get,
  setLocal: localStorage.set,

  getConfig() {
    return this.get([
      'token',
      'owner',
      'repo',
      'branch',
      'folderStrategy',
      'githubUser',
    ]);
  },

  clearAuth() {
    return syncStorage.remove([
      'token',
      'owner',
      'repo',
      'branch',
      'folderStrategy',
      'githubUser',
    ]);
  },
});